import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { loadSim, makeDocument } from "./sim-dom.mjs";

const ID = "guardrail-visibility";
const checkpoint = "checkpoint:observe-guardrail-blind-spot";
const picks = ["content", "intent", "both", "neither"];
const checkpoints = s => s.events.filter(e => e.startsWith("checkpoint:"));
const text = (s, id) => s.find(`#b10-${id}`).textContent;

async function configure(s, example, mode, semantic) {
  await s.press("#b10-example", example);
  await s.press("#b10-mode", mode);
  if (s.find("#b10-semantic").checked !== semantic) await s.press("#b10-semantic");
}

for (const example of ["unasked", "asked", "direct", "tool", "card"]) {
  test(`B10: ${example} separates detection, enforcement and intent in all four configurations`, async () => {
    const s = await loadSim(ID);
    for (const mode of ["block", "log"]) for (const semantic of [true, false]) {
      await configure(s, example, mode, semantic);
      await s.press("#b10-run");
      const readout = text(s, "readout");
      if (example === "unasked" || example === "asked") {
        const denied = example === "unasked" && semantic;
        assert.match(readout, /Content findings: 0/);
        assert.match(readout, new RegExp(`Tool calls stopped: ${Number(denied)}`));
        assert.match(readout, new RegExp(`Emails sent: ${Number(!denied)}`));
        assert.match(text(s, "content-result"), /No content finding/);
        assert.match(text(s, "intent-result"), !semantic ? /Off/ : denied ? /mismatch.*denied/i : /Matches.*allowed/i);
      } else {
        assert.match(readout, /Content findings: 1/);
        assert.match(readout, new RegExp(`Content blocks: ${Number(mode === "block")}`));
        assert.match(readout, /Tool calls evaluated: 0/);
        assert.match(text(s, "content-result"), mode === "block" ? /Finding.*blocked/i : /Finding.*logged.*passes/i);
        assert.match(text(s, "intent-result"), /No proposed tool call/);
      }
      assert.deepEqual(checkpoints(s), [], "exploring without a prediction does not award the insight");
    }
  });
}

for (const prediction of picks) {
  test(`B10: ${prediction} prediction is explained after inspection and awards the observed insight once`, async () => {
    const s = await loadSim(ID);
    await s.press(`#pick-${prediction}`);
    assert.equal(text(s, "verdict"), "", "do not grade the learner's choice before inspection");
    assert.deepEqual(checkpoints(s), []);
    await s.press("#b10-run");
    assert.match(text(s, "verdict"), prediction === "intent" ? /Correct/ : /Your pick:/);
    assert.match(text(s, "verdict"), /summary.*send/i, "explain the request/action mismatch even for a wrong prediction");
    assert.deepEqual(checkpoints(s), [checkpoint]);
    await s.press("#b10-run");
    await s.press("#b10-reset");
    await s.press("#pick-intent");
    await s.press("#b10-run");
    assert.deepEqual(checkpoints(s), [checkpoint], "repeat inspection and Reset cannot emit a second checkpoint");
  });
}

test("B10: another example or an unchecked action cannot earn the blind-spot checkpoint", async () => {
  const s = await loadSim(ID);
  for (const example of ["asked", "direct", "tool", "card"]) {
    await configure(s, example, "block", true);
    await s.press("#pick-content");
    await s.press("#b10-run");
  }
  await configure(s, "unasked", "block", false);
  await s.press("#pick-neither");
  await s.press("#b10-run");
  assert.deepEqual(checkpoints(s), []);
  await s.press("#b10-semantic");
  await s.press("#b10-run");
  assert.deepEqual(checkpoints(s), [], "switching a setting invalidates the earlier prediction");
  await s.press("#pick-intent");
  assert.deepEqual(checkpoints(s), [], "a prediction made after seeing a result still requires another inspection");
  await s.press("#b10-run");
  assert.deepEqual(checkpoints(s), [checkpoint]);
});

test("B10: each setting clears stale prediction/results and Reset restores the whole attempt", async () => {
  const s = await loadSim(ID);
  for (const [selector, value] of [["#b10-example", "card"], ["#b10-mode", "log"], ["#b10-semantic", undefined]]) {
    await s.press("#pick-both");
    await s.press("#b10-run");
    assert.notEqual(text(s, "verdict"), "");
    await s.press(selector, value);
    assert.equal(text(s, "verdict"), "");
    assert.match(text(s, "readout"), /No result yet/);
    for (const pick of picks) assert.equal(s.find(`#pick-${pick}`).getAttribute("aria-pressed"), "false");
  }
  await s.press("#pick-content");
  await s.press("#b10-run");
  await s.press("#b10-reset");
  assert.equal(s.find("#b10-example").value, "unasked");
  assert.equal(s.find("#b10-mode").value, "block");
  assert.equal(s.find("#b10-semantic").checked, true);
  assert.equal(text(s, "verdict"), "");
  assert.match(text(s, "readout"), /No result yet/);
  assert.match(text(s, "content-result"), /Not inspected/);
  assert.match(text(s, "intent-result"), /Not checked/);
});

test("B10: controls work before prediction, retain keyboard focus, and expose changing results", async () => {
  const s = await loadSim(ID);
  const before = s.find('svg[role="img"]').getAttribute("aria-label");
  for (const [selector, value] of [["#b10-example", "direct"], ["#b10-mode", "log"], ["#b10-semantic", undefined], ["#b10-run", undefined], ["#pick-content", undefined], ["#b10-run", undefined], ["#b10-reset", undefined]]) {
    const element = await s.press(selector, value);
    assert.equal(s.doc.activeElement, element, `${selector} keeps its live focused element`);
  }
  await s.press("#b10-run");
  const after = s.find('svg[role="img"]').getAttribute("aria-label");
  assert.notEqual(after, before, "the drawing's accessible description follows the outcome");
  assert.ok(after.length > 30, "the drawing has a descriptive sentence, not just a name");
  assert.equal(s.find("#b10-verdict").getAttribute("role"), "status");
  assert.ok(s.doc.querySelectorAll('[role="status"]').some(e => /summary.*send/i.test(e.textContent)), "the resulting mismatch is announced");
});

test("B10: fallback, late host themes and reduced motion keep the observed result and resize", () => {
  const document = makeDocument();
  document.body.innerHTML = '<main id="app"></main>';
  let init;
  const timers = [], sizes = [], events = [];
  const noop = () => {};
  const context = {
    document, console,
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    clearTimeout: noop,
    requestAnimationFrame: fn => { fn(); return 1; },
    cancelAnimationFrame: noop,
    addEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    createSim: options => {
      init = options.onInit;
      return { isInitialized: () => false, resize: n => sizes.push(n), checkpoint: id => events.push(id), event: noop };
    }
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(new URL(`../packages/${ID}/main.js`, import.meta.url), "utf8"), context);
  assert.ok(timers.some(t => t.delay === 300), "standalone render has the specified 300ms fallback");
  timers.find(t => t.delay === 300).fn();
  document.querySelector("#pick-intent").dispatch("click");
  document.querySelector("#b10-run").dispatch("click");
  const observed = document.querySelector("#b10-readout").textContent;
  assert.match(observed, /Emails sent: 0/);
  for (const theme of ["dark", "light", "system"]) {
    init({ theme, props: {}, reducedMotion: true });
    assert.equal(document.documentElement.dataset.theme, theme === "system" ? undefined : theme);
    assert.ok(document.documentElement.classList.contains("reduced"));
    assert.equal(document.querySelector("#b10-readout").textContent, observed);
  }
  init({ theme: "light", props: {}, reducedMotion: false });
  assert.equal(document.documentElement.classList.contains("reduced"), false);
  assert.deepEqual(events, ["observe-guardrail-blind-spot"]);
  assert.ok(sizes.length >= 6, "fallback, controls and each host update request a size");
});
