// The flow kit (simulations/kit/flow-kit.js + flow-kit.css; skills/lms-authoring-simulations/SKILL.md, "Flow
// diagrams"): a flow sim's main.js starts with the kit's script byte for byte, and its style.css carries the kit's
// CSS right after the sim kit, so every flow sim draws, routes and steps the same way. For each flow sim this runs the
// kit's own spec check, then lays the spec out the way a learner sees it:
//   - on a 1280x720 laptop (the 1100 px LMS frame) the drawing column is 693 px wide and at most 380 px tall, and
//     the laid-out drawing fits in it without being scaled down, so its 12 px labels show at 12 px;
//   - on a 360 px phone and in a lesson's 286 px frame the boxes reflow into narrow columns that fit the width as drawn;
//   - in every layout no arrow crosses a box, and every label fits its box.
// Then it drives the real main.js in the small DOM of sim-dom.mjs: steps, the predict verdict, the one checkpoint,
// and motion that stops (and doesn't start under reduced motion). Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { loadSim } from "./sim-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const KIT_JS = fs.readFileSync(path.join(ROOT, "kit/flow-kit.js"), "utf8");
const KIT_CSS = fs.readFileSync(path.join(ROOT, "kit/flow-kit.css"), "utf8");
const SIM_KIT = fs.readFileSync(path.join(ROOT, "kit/sim-kit.css"), "utf8");
/** The flow sims. A package whose main.js starts with the kit's marker must be listed here too. */
export const ON_FLOW = ["hybrid-agent-flow"];

// The 1100 px frame: #app pads 14 px, the stage panel 14 px plus a 1 px border; from 900 px the stage is two columns,
// the right one minmax(260px, 32%), with a 16 px gap (sim-kit.css). Phones: 360 px less the same padding, and the
// lesson's narrowest frame (286 px, LMS-content#130) less it too.
const LAPTOP_COLUMN = (() => { const inner = 1100 - 2 * 14 - 2 * 15; return Math.floor(inner - 16 - Math.max(260, inner * 0.32)); })();
const LAPTOP_HEIGHT = 380;
const NARROW = [360 - 58, 286 - 58];

const kit = () => {
  const ctx = vm.createContext({});
  vm.runInContext(`${KIT_JS}\nthis.FlowKit = FlowKit;`, ctx);
  return ctx.FlowKit;
};

/** The SPEC a flow sim hands to FlowKit.mount, read by running its main.js after the kit with mount caught. */
function specOf(id) {
  const main = fs.readFileSync(path.join(ROOT, "packages", id, "main.js"), "utf8");
  let spec = null;
  const ctx = vm.createContext({ FlowKit: { mount: (s) => { spec = s; } } });
  vm.runInContext(main.slice(KIT_JS.length), ctx);
  assert.ok(spec, `${id}: main.js never calls FlowKit.mount(SPEC)`);
  return spec;
}

test("the flow kit opens with its marker line and closes with its end marker", () => {
  assert.match(KIT_JS, /^\/\* flow-kit v\d+:/);
  assert.match(KIT_JS.trimEnd(), /\/\* end flow-kit v\d+ \*\/$/);
  assert.match(KIT_CSS, /^\/\* flow-kit v\d+:/);
  assert.match(KIT_CSS.trimEnd(), /\/\* end flow-kit v\d+ \*\/$/);
  assert.doesNotMatch(KIT_JS, /\bfetch\(|XMLHttpRequest|postMessage|import\(|\beval\(|new Function/, "the kit talks to the host only through the sim SDK");
});

for (const id of fs.readdirSync(path.join(ROOT, "packages"))) {
  const main = path.join(ROOT, "packages", id, "main.js");
  if (!fs.existsSync(main)) continue;
  if (fs.readFileSync(main, "utf8").startsWith("/* flow-kit v") && !ON_FLOW.includes(id)) {
    test(`${id}: a package on the flow kit is listed in ON_FLOW`, () => assert.fail(`add ${id} to ON_FLOW in simulations/tests/flow-kit.test.mjs`));
  }
}

const fitsBoxes = (FlowKit, spec, L, where) => {
  for (const r of Object.values(L.routes)) assert.equal(r.hits, 0, `${where}: the arrow ${r.id} crosses a box`);
  for (const n of spec.nodes) {
    const b = L.boxes[n.id];
    assert.ok(FlowKit.textWidth(n.label, 12, true) <= b.w - 10, `${where}: "${n.label}" doesn't fit its ${b.w} px box`);
    if (n.sub) assert.ok(FlowKit.textWidth(n.sub, 10.5, false) <= b.w - 10, `${where}: "${n.sub}" doesn't fit its ${b.w} px box`);
  }
  for (const z of spec.zones || []) {
    const b = L.zones[z.id];
    assert.ok(b.titleW <= b.w - 14, `${where}: the zone title "${b.title}" is wider than its zone; give the zone a short title`);
  }
};

for (const id of ON_FLOW) {
  test(`${id}: main.js starts with the flow kit and style.css with the sim kit then the flow kit, unchanged`, () => {
    const main = fs.readFileSync(path.join(ROOT, "packages", id, "main.js"), "utf8");
    const css = fs.readFileSync(path.join(ROOT, "packages", id, "style.css"), "utf8");
    assert.ok(main.startsWith(KIT_JS), `${id}/main.js must begin with simulations/kit/flow-kit.js exactly; copy it again and put the SPEC after it`);
    assert.ok(css.startsWith(SIM_KIT), `${id}/style.css must begin with simulations/kit/sim-kit.css exactly`);
    assert.ok(css.slice(SIM_KIT.length).replace(/^\s*/, "").startsWith(KIT_CSS), `${id}/style.css must carry simulations/kit/flow-kit.css right after the sim kit`);
  });

  test(`${id}: the spec passes the kit's check`, () => {
    assert.deepEqual([...kit().check(specOf(id))], []);
  });

  test(`${id}: on a laptop the drawing fits its ${LAPTOP_COLUMN} x ${LAPTOP_HEIGHT} px column at full size, arrows clear of boxes`, () => {
    const FlowKit = kit();
    const spec = specOf(id);
    const L = FlowKit.layout(spec, LAPTOP_COLUMN);
    assert.equal(L.narrow, false);
    assert.ok(L.width <= LAPTOP_COLUMN, `${id}: the drawing is ${L.width} px wide, over the ${LAPTOP_COLUMN} px column, so it would shrink; narrow cellWidth`);
    assert.ok(L.height <= LAPTOP_HEIGHT, `${id}: the drawing is ${L.height} px tall, over ${LAPTOP_HEIGHT}, so it would shrink; use fewer rows`);
    fitsBoxes(FlowKit, spec, L, `${id} (laptop)`);
  });

  for (const w of NARROW) {
    test(`${id}: in a ${w} px drawing column the boxes reflow to fit as drawn, arrows clear of boxes`, () => {
      const FlowKit = kit();
      const spec = specOf(id);
      const L = FlowKit.layout(spec, w);
      assert.equal(L.narrow, true);
      assert.ok(L.width <= w, `${id}: the narrow drawing is ${L.width} px wide, over ${w}`);
      fitsBoxes(FlowKit, spec, L, `${id} (${w} px)`);
    });
  }

  test(`${id}: stepping to the end shows the verdict and fires the one checkpoint once`, async () => {
    const spec = specOf(id);
    const sim = await loadSim(id);
    const text = (sel) => sim.find(sel).textContent.replace(/\s+/g, " ").trim();
    assert.equal(text("#caption"), spec.intro);
    const wrong = spec.predict.options.find((o) => o.id !== spec.predict.answer);
    await sim.press(`[data-predict="${wrong.id}"]`);
    for (let i = 1; i <= spec.steps.length; i++) {
      await sim.press("#step");
      await sim.advance(2000);
      assert.equal(text("#caption"), spec.steps[i - 1].text);
      assert.equal(sim.find(`[data-step="${i}"]`).getAttribute("aria-current"), "step");
      assert.equal(sim.doc.activeElement, sim.find("#step"), "Step keeps focus");
      if (i < spec.predict.revealAt) assert.equal(text("#verdict"), "");
    }
    assert.match(text("#verdict"), new RegExp(`^You picked: ${wrong.label}\\. Not so\\.`));
    await sim.press("#step");
    await sim.press("#back");
    await sim.press(`[data-step="${spec.checkpoint.step}"]`);
    assert.deepEqual(sim.events.filter((e) => e.startsWith("checkpoint:")), [`checkpoint:${spec.checkpoint.id}`]);
    await sim.press("#reset");
    assert.equal(text("#caption"), spec.intro);
    assert.equal(text("#verdict"), "");
  });

  test(`${id}: the token runs a step's arrows once and stops at the end`, async () => {
    const sim = await loadSim(id);
    await sim.press("#step");
    await sim.advance(100);
    const mid = [sim.find("#fk-token").getAttribute("cx"), sim.find("#fk-token").getAttribute("cy")];
    await sim.advance(3000);
    const end = [sim.find("#fk-token").getAttribute("cx"), sim.find("#fk-token").getAttribute("cy")];
    assert.notDeepEqual(mid, end, "the token moves along the arrows");
    await sim.advance(3000);
    assert.deepEqual([sim.find("#fk-token").getAttribute("cx"), sim.find("#fk-token").getAttribute("cy")], end, "and then rests");
  });
}
