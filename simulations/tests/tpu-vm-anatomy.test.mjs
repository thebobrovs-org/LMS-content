// LMS-content#130: tpu-vm-anatomy writes the whole app again on every render. On a narrow screen its cutaway
// (.stage-scroll) scrolls sideways, so selecting a part or a generation must keep the cutaway's horizontal scroll (a part
// selected after scrolling stays in view) and give focus back to the control that had it; and a part that takes focus is
// scrolled fully into the cutaway's view. The real main.js runs in a Node vm with a small DOM in which every innerHTML
// write makes new elements from the markup's opening tags, so an element from before a render is gone after it, as in a
// browser. As in a browser, focus() fires focusin, which bubbles to #app, so restoring focus and scrolling the focused
// part into view are tested together (LMS-content#132): each part has a left edge (its position among the parts × 60 px,
// 50 px wide) and the cutaway shows 250 px, so scrollIntoView({ inline: "nearest" }) moves the scroll only when the part
// isn't fully in view. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const MAIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages/tpu-vm-anatomy/main.js");
const SOURCE = fs.readFileSync(MAIN, "utf8");
const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const PART_STEP = 60;
const PART_WIDTH = 50;
const VIEW = 250;

function loadSim(source = SOURCE) {
  let elements = [];
  let active = null;
  const stage = () => elements.find((e) => e.classList.contains("stage-scroll"));
  const leftOf = (el) => elements.filter((e) => "data-part" in e.attrs).indexOf(el) * PART_STEP;
  /** scrollIntoView's "nearest": the least scroll that brings the part fully into the cutaway's view. */
  const nearest = (el) => {
    const s = stage();
    if (!s || !("data-part" in el.attrs)) return;
    const left = leftOf(el);
    if (left < s.scrollLeft) s.scrollLeft = left;
    else if (left + PART_WIDTH > s.scrollLeft + VIEW) s.scrollLeft = left + PART_WIDTH - VIEW;
  };
  const make = (attrs) => ({
    attrs,
    listeners: {},
    scrollLeft: 0,
    focusIns: 0,
    scrolledByFocus: false,
    scrolledIntoView: [], // { options, scrollLeftAtCall }: the cutaway's scroll when the call was made
    scrollIntoView(options) {
      this.scrolledIntoView.push({ options: JSON.stringify(options), scrollLeftAtCall: stage()?.scrollLeft });
      nearest(this);
    },
    hasAttribute(name) {
      return name in this.attrs;
    },
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    classList: { contains: (c) => (attrs.class ?? "").split(/\s+/).includes(c) },
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    },
    focus(options) {
      active = this;
      if (!elements.includes(this)) return;
      if (!options?.preventScroll) {
        this.scrolledByFocus = true; // a browser scrolls a focused element into view unless told not to
        nearest(this);
      }
      this.focusIns++;
      for (const fn of app.listeners.focusin ?? []) fn({ target: this });
    },
  });
  const matches = (el, selector) => {
    const cls = /^\.([\w-]+)$/.exec(selector);
    if (cls) return el.classList.contains(cls[1]);
    const attr = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (attr) return attr[2] === undefined ? el.attrs[attr[1]] !== undefined : el.attrs[attr[1]] === attr[2];
    throw new Error(`this test's DOM doesn't support the selector ${selector}`);
  };
  let html = "";
  const app = {
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    },
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = String(value);
      elements = [...html.matchAll(/<\w+\b[^>]*>/g)].map((m) => make(attrsOf(m[0])));
      active = null; // what had focus was removed with the old markup
    },
    contains: (el) => elements.includes(el),
    querySelector: (selector) => elements.find((el) => matches(el, selector)) ?? null,
    querySelectorAll: (selector) => elements.filter((el) => matches(el, selector)),
  };
  const outside = make({ id: "outside" });
  const context = vm.createContext({
    document: {
      getElementById: (id) => (id === "app" ? app : null),
      get activeElement() {
        return active;
      },
      documentElement: { dataset: {} },
      body: { scrollHeight: 0 },
    },
    requestAnimationFrame: () => 0,
    setTimeout: () => 0,
    createSim: () => ({ checkpoint() {}, event() {}, resize() {}, isInitialized: () => true }),
  });
  context.window = context;
  vm.runInContext(source, context, { filename: MAIN });
  vm.runInContext("render()", context);
  const fire = (el, type, init = {}) => {
    assert.ok(el.listeners[type]?.length, `${JSON.stringify(el.attrs)} has a ${type} listener`);
    for (const fn of [...el.listeners[type]]) fn({ target: el, preventDefault() {}, stopPropagation() {}, ...init });
  };
  /** A focusin on `target`, as it bubbles to #app. */
  const focusIn = (target) => {
    assert.ok(app.listeners.focusin?.length, "#app has a focusin listener");
    for (const fn of app.listeners.focusin) fn({ target });
  };
  return { app, fire, focusIn, outside, leftOf, active: () => active, all: (selector) => app.querySelectorAll(selector), stage };
}

/**
 * Select the `n`th part named `part` with `action` (a click or a key) after scrolling the cutaway to `scroll`, and return
 * what went wrong with the render's restore: focus not given back to the new part, no focusin on it, a scrollIntoView
 * that ran before the cutaway's scroll was restored, a focus that scrolled by itself, or a final scroll other than
 * `expected` (the restored scroll, or the least scroll that brings the part into view).
 */
function restoreProblems(source, { part, n = 0, scroll, action, expected }) {
  const sim = loadSim(source);
  const el = sim.all(`[data-part="${part}"]`)[n];
  el.focus(); // a click or Tab focuses the part first, which scrolls it into view
  sim.stage().scrollLeft = scroll(sim.leftOf(el)); // then the learner scrolls the cutaway
  action(sim, el);
  const again = sim.all(`[data-part="${part}"]`)[n];
  const problems = [];
  if (sim.stage() === null) return ["no cutaway after the render"];
  if (sim.active() !== again) problems.push("focus isn't on the new part");
  if (again.focusIns !== 1) problems.push(`the new part had ${again.focusIns} focusin events`);
  const calls = again.scrolledIntoView;
  if (calls.length !== 1 || calls[0].options !== JSON.stringify({ block: "nearest", inline: "nearest" })) problems.push(`scrollIntoView calls: ${JSON.stringify(calls)}`);
  else if (calls[0].scrollLeftAtCall !== scroll(sim.leftOf(again))) problems.push(`scrollIntoView ran with the cutaway at ${calls[0].scrollLeftAtCall}, before its scroll was restored`);
  if (again.scrolledByFocus) problems.push("restoring focus scrolled by itself (no preventScroll)");
  const want = expected(sim.leftOf(again));
  if (sim.stage().scrollLeft !== want) problems.push(`the cutaway ended at ${sim.stage().scrollLeft}, not ${want}`);
  return problems;
}

const click = (sim, el) => sim.fire(el, "click");
const enter = (sim, el) => sim.fire(el, "keydown", { key: "Enter" });
const inView = (left) => left - 100; // the part stays fully in the 250 px view
const same = (left) => inView(left);

test("selecting a part with the mouse after scrolling the cutaway keeps its scroll, and the part keeps focus", () => {
  const sim = loadSim();
  const stage = sim.stage();
  assert.ok(stage, "the cutaway is in a .stage-scroll region");
  const mxu = sim.all('[data-part="mxu"]')[2];
  mxu.focus();
  stage.scrollLeft = sim.leftOf(mxu) - 100;
  const scrolled = stage.scrollLeft;
  sim.fire(mxu, "click");
  const after = sim.stage();
  assert.notEqual(after, stage, "the render wrote the cutaway again");
  assert.equal(after.scrollLeft, scrolled);
  assert.equal(sim.active(), sim.all('[data-part="mxu"]')[2], "the third MXU of the new markup has focus");
  assert.match(sim.app.innerHTML, /class="part sel mxu"/);
});

test("selecting a part with the keyboard keeps the cutaway's scroll and the part's focus", () => {
  const sim = loadSim();
  const ici = sim.all('[data-part="ici"]')[0];
  ici.focus();
  sim.stage().scrollLeft = sim.leftOf(ici) - 150;
  const scrolled = sim.stage().scrollLeft;
  sim.fire(ici, "keydown", { key: "Enter" });
  assert.equal(sim.stage().scrollLeft, scrolled);
  assert.equal(sim.active(), sim.all('[data-part="ici"]')[0]);
});

test("switching the generation keeps the cutaway's scroll and the tab's focus", () => {
  const sim = loadSim();
  const tab = sim.all('[data-gen="8i"]')[0];
  tab.focus();
  sim.stage().scrollLeft = 180;
  sim.fire(tab, "click");
  assert.equal(sim.stage().scrollLeft, 180);
  assert.equal(sim.active(), sim.all('[data-gen="8i"]')[0]);
  assert.match(sim.app.innerHTML, /data-part="cae"/, "the 8i chip is drawn");
});

test("a render with focus outside the simulation moves focus nowhere", () => {
  const sim = loadSim();
  sim.outside.focus();
  sim.fire(sim.all('[data-part="host"]')[0], "click");
  assert.equal(sim.active(), null);
});

test("a part that takes focus is scrolled fully into the cutaway's view; a generation tab is not scrolled", () => {
  const sim = loadSim();
  const label = sim.all('[data-part="tensorcore"]').find((el) => el.getAttribute("tabindex") === "0");
  sim.focusIn(label);
  assert.deepEqual(label.scrolledIntoView.map((c) => c.options), [JSON.stringify({ block: "nearest", inline: "nearest" })]);
  const tab = sim.all('[data-gen="v3"]')[0];
  sim.focusIn(tab);
  assert.deepEqual(tab.scrolledIntoView, []);
});

test("selecting a part with the Space key keeps the cutaway's scroll and the part's focus", () => {
  const sim = loadSim();
  const stage = sim.stage();
  const ici = sim.all('[data-part="ici"]')[0];
  ici.focus();
  stage.scrollLeft = sim.leftOf(ici) - 100;
  const scrolled = stage.scrollLeft;
  sim.fire(ici, "keydown", { key: " " });
  const after = sim.stage();
  assert.notEqual(after, stage, "the render wrote the cutaway again");
  assert.equal(after.scrollLeft, scrolled);
  assert.equal(sim.active(), sim.all('[data-part="ici"]')[0]);
  assert.match(sim.app.innerHTML, /class="part sel side ici"/);
});

test("non-activation key presses on a part do not trigger selection or re-render", () => {
  const sim = loadSim();
  const host = sim.all('[data-part="host"]')[0];
  host.focus();
  const stage = sim.stage();
  stage.scrollLeft = 300;
  sim.fire(host, "keydown", { key: "ArrowRight" });
  const after = sim.stage();
  assert.equal(after, stage, "no re-render occurred");
  assert.equal(after.scrollLeft, 300);
  assert.equal(sim.active(), host);
});

test("restoring focus fires focusin on the new part, whose scrollIntoView runs after the cutaway's scroll is restored and leaves it there (LMS-content#132)", () => {
  assert.deepEqual(restoreProblems(SOURCE, { part: "mxu", n: 2, scroll: inView, action: click, expected: same }), [], "a click on the third MXU");
  assert.deepEqual(restoreProblems(SOURCE, { part: "ici", scroll: inView, action: enter, expected: same }), [], "Enter on ICI");
  assert.deepEqual(restoreProblems(SOURCE, { part: "smem", n: 1, scroll: inView, action: click, expected: same }), [], "a click on the second SMEM");
});

test("a focused part scrolled out of view before it is selected is brought back into view from the restored scroll, by the least scroll (LMS-content#132)", () => {
  // Focus stays on ICI while the learner scrolls to the start; Enter selects it: the render restores 0, then the focusin
  // brings ICI's right edge to the view's.
  assert.deepEqual(restoreProblems(SOURCE, { part: "ici", scroll: () => 0, action: enter, expected: (left) => left + PART_WIDTH - VIEW }), []);
});

test("the check catches focus restored before the scroll, and focus restored without preventScroll (LMS-content#132)", () => {
  const swapped = SOURCE.replace(/(\n[ \t]*if \(stageScroll\) stageScroll\.scrollLeft = scrollLeft;)(\n[ \t]*if \(focused\)[^\n]*)/, "$2$1");
  assert.notEqual(swapped, SOURCE, "main.js restores the scroll, then focus, as this variant expects");
  assert.match(restoreProblems(swapped, { part: "mxu", n: 2, scroll: inView, action: click, expected: same }).join("\n"), /scrollIntoView ran with the cutaway at 0, before its scroll was restored/);
  const scrolling = SOURCE.replace("focus({ preventScroll: true })", "focus()");
  assert.notEqual(scrolling, SOURCE, "main.js restores focus with preventScroll, as this variant expects");
  assert.match(restoreProblems(scrolling, { part: "ici", scroll: () => 0, action: enter, expected: (left) => left + PART_WIDTH - VIEW }).join("\n"), /restoring focus scrolled by itself/);
});
