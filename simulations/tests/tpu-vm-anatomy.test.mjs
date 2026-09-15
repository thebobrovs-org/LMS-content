// LMS-content#130: tpu-vm-anatomy writes the whole app again on every render. On a narrow screen its cutaway
// (.stage-scroll) scrolls sideways, so selecting a part or a generation must keep the cutaway's horizontal scroll (a part
// selected after scrolling stays in view) and give focus back to the control that had it; and a part that takes focus is
// scrolled fully into the cutaway's view. The real main.js runs in a Node vm with a small DOM in which every innerHTML
// write makes new elements from the markup's opening tags, so an element from before a render is gone after it, as in a
// browser. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const MAIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages/tpu-vm-anatomy/main.js");
const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

function loadSim() {
  let elements = [];
  let active = null;
  const make = (attrs) => ({
    attrs,
    listeners: {},
    scrollLeft: 0,
    scrolledIntoView: [],
    scrollIntoView(options) {
      this.scrolledIntoView.push(JSON.stringify(options));
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
    focus() {
      active = this;
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
  vm.runInContext(fs.readFileSync(MAIN, "utf8"), context, { filename: MAIN });
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
  return { app, fire, focusIn, outside, active: () => active, all: (selector) => app.querySelectorAll(selector) };
}

test("selecting a part with the mouse after scrolling the cutaway keeps its scroll, and the part keeps focus", () => {
  const sim = loadSim();
  const stage = sim.app.querySelector(".stage-scroll");
  assert.ok(stage, "the cutaway is in a .stage-scroll region");
  stage.scrollLeft = 320;
  const mxu = sim.all('[data-part="mxu"]')[2];
  mxu.focus();
  sim.fire(mxu, "click");
  const after = sim.app.querySelector(".stage-scroll");
  assert.notEqual(after, stage, "the render wrote the cutaway again");
  assert.equal(after.scrollLeft, 320);
  assert.equal(sim.active(), sim.all('[data-part="mxu"]')[2], "the third MXU of the new markup has focus");
  assert.match(sim.app.innerHTML, /class="part sel mxu"/);
});

test("selecting a part with the keyboard keeps the cutaway's scroll and the part's focus", () => {
  const sim = loadSim();
  sim.app.querySelector(".stage-scroll").scrollLeft = 500;
  const ici = sim.all('[data-part="ici"]')[0];
  ici.focus();
  sim.fire(ici, "keydown", { key: "Enter" });
  assert.equal(sim.app.querySelector(".stage-scroll").scrollLeft, 500);
  assert.equal(sim.active(), sim.all('[data-part="ici"]')[0]);
});

test("switching the generation keeps the cutaway's scroll and the tab's focus", () => {
  const sim = loadSim();
  sim.app.querySelector(".stage-scroll").scrollLeft = 180;
  const tab = sim.all('[data-gen="8i"]')[0];
  tab.focus();
  sim.fire(tab, "click");
  assert.equal(sim.app.querySelector(".stage-scroll").scrollLeft, 180);
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
  assert.deepEqual(label.scrolledIntoView, [JSON.stringify({ block: "nearest", inline: "nearest" })]);
  const tab = sim.all('[data-gen="v3"]')[0];
  sim.focusIn(tab);
  assert.deepEqual(tab.scrolledIntoView, []);
});

test("selecting a part with the Space key keeps the cutaway's scroll and the part's focus", () => {
  const sim = loadSim();
  const stage = sim.app.querySelector(".stage-scroll");
  stage.scrollLeft = 450;
  const ici = sim.all('[data-part="ici"]')[0];
  ici.focus();
  sim.fire(ici, "keydown", { key: " " });
  const after = sim.app.querySelector(".stage-scroll");
  assert.notEqual(after, stage, "the render wrote the cutaway again");
  assert.equal(after.scrollLeft, 450);
  assert.equal(sim.active(), sim.all('[data-part="ici"]')[0]);
  assert.match(sim.app.innerHTML, /class="part sel side ici"/);
});

test("non-activation key presses on a part do not trigger selection or re-render", () => {
  const sim = loadSim();
  const stage = sim.app.querySelector(".stage-scroll");
  stage.scrollLeft = 300;
  const host = sim.all('[data-part="host"]')[0];
  host.focus();
  sim.fire(host, "keydown", { key: "ArrowRight" });
  const after = sim.app.querySelector(".stage-scroll");
  assert.equal(after, stage, "no re-render occurred");
  assert.equal(after.scrollLeft, 300);
  assert.equal(sim.active(), host);
});

