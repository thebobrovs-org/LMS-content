// LMS-content#135: in eight more simulations a control a keyboard user pressed dropped focus to the page, so the next
// Tab restarted at the simulation's first control (and a slider that lost focus after one arrow press couldn't be
// moved by keyboard at all). Three causes: markup holding the control was written again, the pressed button switched
// itself off with `disabled`, or it was hidden while it had focus. Each real main.js runs in a Node vm against a small
// DOM that behaves like a browser in the ways that matter here:
//   - writing innerHTML makes new elements from the markup, so an element from before is detached afterwards;
//   - document.activeElement is the body once the focused element is detached, disabled or hidden (display: none, or
//     the hidden attribute, on it or an ancestor), as the browser's focus fixup makes it;
//   - timers and animation frames run on a fake clock, so a step that plays out over time (a run, a compile) plays out.
// A test focuses a control, presses it the way its key does (a click for Enter or Space; a new value and input/change
// for an arrow on a slider or a select; change for Space on a checkbox), lets 1.5 s pass, and checks where focus is:
// on the same control, or where the fix sends it on purpose (the next thing to do). Run by `npm run gate`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { describe, loadSim, makeDocument, matches } from "./sim-dom.mjs";

/**
 * Each case: `setup` presses first (unchecked), then `press` (with `value` for a slider or a select). `focus` is where
 * focus must be after 1.5 s (`at`, if another time) — the same control unless the fix moves it on purpose; `same`
 * requires the very element that was pressed (a control that is updated in place, never written again); `then`
 * checks once more after more time has passed.
 */
const CASES = {
  "capacity-orchestrator": [
    { press: "#btn-deploy", focus: "#btn-stop", why: "Deploy hides itself; Abort takes focus" },
    { setup: ["#btn-deploy"], press: "#btn-stop", focus: "#btn-deploy", why: "Abort hides itself; Deploy takes focus back" },
    { setup: ["#btn-deploy"], focusOnly: "#btn-stop", at: 15000, focus: "#btn-deploy", why: "the run finishes while Abort has focus" },
  ],
  "gradient-sync-explorer": [
    { press: "#c-p", value: 30, focus: "#c-p", same: true },
    { press: "#c-n", value: 6, focus: "#c-n", same: true },
    { press: "#c-b", value: "900", focus: "#c-b", same: true },
    { press: "#c-c", value: 2400, focus: "#c-c", same: true },
    { press: "#c-o", focus: "#c-o", same: true },
  ],
  "moe-factory": [
    { press: '[data-mode="top1"]', focus: '[data-mode="top1"]' },
    { press: '[data-mode="top2"]', focus: '[data-mode="top2"]' },
    { press: '[data-mode="dense"]', focus: '[data-mode="dense"]' },
    { press: "#route", focus: "#route" },
    { setup: ["#route"], press: "#reset", focus: "#reset" },
  ],
  "scale-hierarchy": [
    ...["0", "1", "2", "3", "4", "5"].map((n) => ({ press: `[data-i="${n}"]`, focus: `[data-i="${n}"]` })),
    { press: '[data-act="next"]', focus: '[data-act="next"]' },
    { setup: ['[data-i="2"]'], press: '[data-act="prev"]', focus: '[data-act="prev"]' },
    { setup: ['[data-i="4"]'], press: '[data-act="next"]', focus: '[data-act="prev"]', why: "Scale up switches off at Multislice; Zoom in takes focus" },
    { setup: ['[data-i="1"]'], press: '[data-act="prev"]', focus: '[data-act="next"]', why: "Zoom in switches off at Chip; Scale up takes focus" },
  ],
  "spmd-shard-explorer": [
    { press: "#btn-run", focus: "#btn-run", same: true, then: [10000, "#btn-run"], why: "Run stays focused through the step and after it" },
    { setup: ["#btn-run"], wait: 10000, press: "#btn-reset", focus: "#btn-run", why: "Reset switches itself off; Run takes focus" },
    { press: '[data-spec="model"]', focus: '[data-spec="model"]', same: true, why: "PartitionSpec segment button keeps focus when selected" },
  ],
  "tensor-rank-explorer": ["0", "1", "2", "3"].map((n) => ({ press: `[data-r="${n}"]`, focus: `[data-r="${n}"]`, same: true })),
  "tpu-evolution-timeline": [
    ...["0", "1", "2", "3", "4", "5", "6", "7"].map((n) => ({ press: `[data-i="${n}"]`, focus: `[data-i="${n}"]` })),
    { press: '[data-act="next"]', focus: '[data-act="next"]' },
    { setup: ['[data-i="3"]'], press: '[data-act="prev"]', focus: '[data-act="prev"]' },
    { setup: ['[data-i="3"]'], press: '[data-act="reset"]', focus: '[data-act="reset"]' },
    { setup: ['[data-i="7"]'], press: '[data-act="reset"]', focus: '[data-act="reset"]', why: "Reset from last generation restores gen 0 and keeps focus" },
    { setup: ['[data-i="6"]'], press: '[data-act="next"]', focus: '[data-act="prev"]', why: "Next gen switches off at the last generation; Prev takes focus" },
    { setup: ['[data-i="1"]'], press: '[data-act="prev"]', focus: '[data-act="next"]', why: "Prev switches off at the first generation; Next gen takes focus" },
  ],
  "xla-fusion-explorer": [
    { press: "#btn-step", focus: "#btn-step", same: true },
    { setup: ["#btn-step", "#btn-step", "#btn-step"], press: "#btn-step", focus: "#btn-run", why: "the last Step compiles and switches off; Execute takes focus" },
    { press: "#btn-auto-jit", focus: "#btn-auto-jit", same: true, then: [6000, "#btn-run"], why: "Auto-compile keeps focus while it runs, then hands it to Execute" },
    { setup: ["#btn-auto-jit"], wait: 6000, press: "#btn-run", focus: "#btn-run", same: true, then: [10000, "#btn-run"], why: "Execute stays focused through the race" },
    { setup: ["#btn-auto-jit"], wait: 6000, press: "#btn-reset", focus: "#btn-reset", same: true, why: "Reset keeps focus after restoring initial compile state" },
    { setup: ["#btn-step"], press: "#btn-auto-jit", focusOnly: "#inspector-content [tabindex]", at: 3000, focus: "#inspector-content [tabindex]", same: true, why: "the code region keeps focus while Auto-compile advances the stages" },
  ],
};

for (const [id, cases] of Object.entries(CASES)) {
  for (const c of cases) {
    const what = c.focusOnly ? `focus on ${c.focusOnly}${c.press ? ` after ${c.press}` : ""}` : `pressing ${c.press}`;
    test(`${id}: ${what} leaves focus on ${c.focus}${c.why ? ` (${c.why})` : ""}, not on the page (#135)`, async () => {
      const sim = await loadSim(id);
      for (const s of c.setup ?? []) await sim.press(s);
      if (c.wait) await sim.advance(c.wait);
      let el;
      if (c.press) el = await sim.press(c.press, c.value);
      if (c.focusOnly) {
        el = sim.find(c.focusOnly);
        el.focus();
        assert.equal(sim.doc.activeElement, el, `${c.focusOnly} can't take focus`);
      }
      await sim.advance(c.at ?? 1500);
      const at = sim.doc.activeElement;
      assert.notEqual(at, sim.doc.body, `focus fell to the page body after ${what}`);
      assert.ok(matches(at, c.focus), `focus is on ${describe(at)}, not ${c.focus}`);
      if (c.same) assert.equal(at, el, "focus is on a new element: the control was written again");
      if (c.then) {
        await sim.advance(c.then[0]);
        const later = sim.doc.activeElement;
        assert.notEqual(later, sim.doc.body, `focus fell to the page body ${c.then[0]} ms later`);
        assert.ok(matches(later, c.then[1]), `${c.then[0]} ms later focus is on ${describe(later)}, not ${c.then[1]}`);
      }
    });
  }
}

test("the test DOM drops focus the way a browser does: a written-over, disabled or hidden element loses it", () => {
  const doc = makeDocument();
  doc.body.innerHTML = `<div id="box"><button id="b">B</button></div>`;
  const b = doc.getElementById("b");
  b.focus();
  assert.equal(doc.activeElement, b);
  b.disabled = true;
  assert.equal(doc.activeElement, doc.body, "disabled");
  b.disabled = false;
  assert.equal(doc.activeElement, b, "enabled again (no blur happened in between)");
  b.style.display = "none";
  assert.equal(doc.activeElement, doc.body, "hidden");
  b.style.display = "";
  doc.getElementById("box").innerHTML = `<button id="b">B</button>`;
  assert.equal(doc.activeElement, doc.body, "written over");
  assert.notEqual(doc.getElementById("b"), b, "the markup made a new element");
});
