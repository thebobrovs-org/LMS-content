import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { loadSim, makeDocument } from "./sim-dom.mjs";

const ID = "access-boundary-explorer";
const checkpoints = (s) => s.events.filter(e => e.startsWith("checkpoint:"));
const readable = (s) => s.doc.querySelectorAll(".resource.allowed .resource-title").map(e => e.textContent);

for (const [boundary, states] of [
  [true, [["Invoices"], ["Invoices", "Exports"], []]],
  [false, [["Invoices"], ["Invoices", "Exports", "Payroll", "Backups"], []]]
]) test(`B07: actual readable buckets across every grant, boundary ${boundary}`, async () => {
  const s = await loadSim(ID);
  await s.press(boundary ? "#boundary-on" : "#boundary-off");
  for (const expected of states) {
    assert.deepEqual(readable(s), expected);
    assert.equal(s.find("#readout").textContent, `Readable: ${expected.length} / 4 buckets`);
    await s.press("#action");
  }
  assert.deepEqual(checkpoints(s), [], "free exploration does not record a prediction checkpoint");
  assert.deepEqual(readable(s), ["Invoices"], "grant cycle restores the narrow grant");
});

for (const prediction of ["invoices", "finance", "all"]) test(`B07: explains ${prediction} prediction and emits once after both observations`, async () => {
  const s = await loadSim(ID);
  for (const selector of [`#pick-${prediction}`, "#action"]) {
    const button = await s.press(selector);
    assert.equal(s.doc.activeElement, button, "render retains keyboard focus");
  }
  assert.deepEqual(readable(s), ["Invoices", "Exports"]);
  assert.match(s.find("#verdict").textContent, prediction === "finance" ? /That's right/ : /The result was both Finance buckets/);
  assert.match(s.find("#verdict").textContent, /broad grant adds Exports.*HR and Production ineligible/);
  assert.deepEqual(checkpoints(s), [], "seeing only the capped grant is not the full insight");
  const button = await s.press("#action");
  assert.equal(s.doc.activeElement, button);
  assert.deepEqual(readable(s), []);
  assert.match(s.find("#caption").textContent, /Finance is still eligible.*boundary grants nothing/);
  assert.deepEqual(checkpoints(s), ["checkpoint:observe-boundary-caps"]);
  await s.press("#reset");
  for (const selector of ["#pick-finance", "#action", "#action"]) await s.press(selector);
  assert.equal(checkpoints(s).length, 1, "Reset does not award the checkpoint twice");
});

test("B07: a new prediction starts fresh; boundary-off observations do not satisfy the checkpoint", async () => {
  const s = await loadSim(ID);
  for (const selector of ["#pick-all", "#boundary-off", "#action", "#action", "#boundary-on"]) await s.press(selector);
  assert.deepEqual(checkpoints(s), []);
  await s.press("#pick-finance");
  await s.press("#action");
  assert.match(s.find("#verdict").textContent, /That's right/);
  await s.press("#pick-invoices");
  assert.equal(s.find("#verdict").textContent, "");
  assert.deepEqual(readable(s), ["Invoices"]);
  await s.press("#boundary-off");
  await s.press("#action");
  await s.press("#action");
  await s.press("#boundary-on");
  assert.deepEqual(checkpoints(s), [], "the previous prediction's observation was cleared");
});

test("B07: resource descriptions, live verdict and named scrolling region survive policy changes", async () => {
  const s = await loadSim(ID);
  const before = s.find('svg[role="img"]').getAttribute("aria-label");
  await s.press("#action");
  const after = s.find('svg[role="img"]').getAttribute("aria-label");
  assert.notEqual(after, before);
  assert.match(after, /Finance Exports: Read allowed/);
  assert.match(after, /HR Payroll: Outside boundary/);
  assert.equal(s.find("#verdict").getAttribute("role"), "status");
  assert.equal(s.find(".scroll").getAttribute("tabindex"), "0");
  assert.match(s.find(".scroll").getAttribute("aria-label"), /Finance, HR and Production/);
});

test("B07: standalone fallback renders; late host theme and reduced motion preserve the outcome", () => {
  const document = makeDocument();
  document.body.innerHTML = '<main id="app"></main>';
  let init, fallback;
  const sizes = [];
  const context = { document, console, setTimeout: fn => { fallback = fn; },
    requestAnimationFrame: fn => fn(), addEventListener() {},
    createSim: options => {
      init = options.onInit;
      return { isInitialized: () => false, resize: n => sizes.push(n), checkpoint() {} };
    }
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(new URL(`../packages/${ID}/main.js`, import.meta.url), "utf8"), context);
  fallback();
  assert.equal(document.querySelector("#readout").textContent, "Readable: 1 / 4 buckets");
  document.querySelector("#action").dispatch("click");
  for (const theme of ["dark", "light", "system"]) {
    init({ theme, reducedMotion: true });
    assert.equal(document.documentElement.dataset.theme, theme === "system" ? undefined : theme);
    assert.ok(document.documentElement.classList.contains("reduced"));
    assert.equal(document.querySelector("#readout").textContent, "Readable: 2 / 4 buckets");
  }
  assert.ok(sizes.length >= 5, "fallback, action and host updates request a resize");
});
