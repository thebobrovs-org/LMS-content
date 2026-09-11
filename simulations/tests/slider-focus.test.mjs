// LMS-content#59: moving a slider must not rebuild it. Five sims used to rewrite the
// markup holding their range inputs on every input event, so keyboard users lost focus
// after one arrow press and mouse drags were cut short. Each real main.js runs in a
// Node vm with a small fake DOM that records every innerHTML write and every listener.
// Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

/**
 * A fake DOM. Elements are looked up by id (or selector) and stay the same object, the
 * way a real element does until markup replaces it. Every innerHTML write is recorded,
 * so a test can see whether a slider's markup was written again.
 */
function fakeDom() {
  const writes = []; // { key, html }, in order
  const els = new Map();
  const doc = {
    getElementById: (id) => el(id),
    querySelector: (sel) => el(sel.startsWith("#") ? sel.slice(1) : sel),
    // "… input" selectors find the range inputs present in the markup written so far.
    querySelectorAll: (sel) => (/\binput$/.test(sel) ? inputs() : []),
    documentElement: { dataset: {} },
    body: { scrollHeight: 0 },
    addEventListener() {},
  };
  function el(key) {
    if (!els.has(key)) {
      let html = "";
      els.set(key, {
        id: key,
        listeners: {},
        value: "",
        textContent: "",
        className: "",
        hidden: false,
        style: {},
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
        getAttribute: () => null,
        querySelector: (sel) => doc.querySelector(sel),
        querySelectorAll: (sel) => doc.querySelectorAll(sel),
        get innerHTML() { return html; },
        set innerHTML(value) { html = String(value); writes.push({ key, html }); },
      });
    }
    return els.get(key);
  }
  function inputs() {
    const ids = new Set();
    for (const e of els.values()) for (const m of e.innerHTML.matchAll(/<input[^>]*\bid="([^"]+)"/g)) ids.add(m[1]);
    return [...ids].map(el);
  }
  return { doc, el, writes };
}

function loadSim(id) {
  const { doc, el, writes } = fakeDom();
  const events = [];
  const g = {
    document: doc,
    console,
    requestAnimationFrame: () => 0,
    setTimeout: () => 0,
    clearTimeout: () => {},
    matchMedia: () => ({ matches: false }),
    ResizeObserver: class { observe() {} disconnect() {} },
    createSim: () => ({
      checkpoint: (c) => events.push(`checkpoint:${c}`),
      event: (name) => events.push(name),
      resize() {},
      isInitialized: () => true,
    }),
  };
  g.window = g;
  const context = vm.createContext(g);
  const file = path.join(PACKAGES, id, "main.js");
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return {
    run: (code) => vm.runInContext(code, context),
    el,
    writes,
    events,
    /** Move a slider the way an arrow key or a drag does: set its value and fire its input listeners. */
    input(sliderId, value) {
      const slider = el(sliderId);
      slider.value = String(value);
      // A snapshot: a render that wires the slider again mustn't feed this loop forever.
      const fns = [...(slider.listeners.input ?? [])];
      assert.ok(fns.length > 0, `${sliderId} has no input listener`);
      for (const fn of fns) fn({ target: slider });
    },
  };
}

const CASES = [
  { id: "consistent-hash-ring", start: "reset(); render()", slider: "rep", moves: [3, 4], label: ["rep-val", "4"] },
  { id: "gradient-descent-explorer", start: "render()", slider: "lr", moves: [0.2, 0.3], label: ["lr-val", "0.300"] },
  { id: "number-format-explorer", start: "render()", slider: "L", moves: [4.5, 5], label: ["L-val", "1.0e+5"] },
  { id: "arithmetic-intensity-calculator", start: "render()", slider: "b", moves: [300, 512], label: ["b-val", "512"] },
  { id: "matmul-tiler", start: "render()", slider: "s-M", moves: [400, 500], label: ["M-val", "500"] },
];

for (const c of CASES) {
  test(`${c.id}: moving a slider updates the outputs in place, without rebuilding the slider`, () => {
    const sim = loadSim(c.id);
    sim.run(c.start);
    const afterMount = sim.writes.length;
    for (const v of c.moves) sim.input(c.slider, v); // two steps, like pressing → twice
    const later = sim.writes.slice(afterMount);
    assert.ok(later.length > 0, "the outputs were redrawn");
    assert.deepEqual(later.filter((w) => /type="range"/.test(w.html)).map((w) => w.key), [], "a slider's markup was written again");
    assert.equal(sim.el(c.label[0]).textContent, c.label[1], "the value label follows the slider");
    assert.equal(sim.el(c.slider).listeners.input.length, 1, "the slider is wired once, not on every render");
  });
}

test("number-format-explorer: a preset moves the slider and the label without rebuilding them", () => {
  const sim = loadSim("number-format-explorer");
  sim.run("render()");
  const afterMount = sim.writes.length;
  sim.run("setL(-7)");
  assert.equal(sim.el("L").value, "-7");
  assert.equal(sim.el("L-val").textContent, "1.0e-7");
  assert.deepEqual(sim.writes.slice(afterMount).filter((w) => /type="range"/.test(w.html)), []);
  sim.input("L", 5);
  assert.ok(sim.events.includes("checkpoint:observe-overflow"), "fp16 overflow at 1e5 still completes the checkpoint");
  assert.match(sim.el("readout").innerHTML, /fp16 can't hold this value/);
});

test("matmul-tiler: the padded size next to each slider updates in place", () => {
  const sim = loadSim("matmul-tiler");
  sim.run("render()");
  sim.input("s-M", 500);
  assert.equal(sim.el("M-pad").textContent, "→ 512");
  assert.match(sim.el("M-pad").className, /waste/);
  sim.input("s-M", 512);
  assert.equal(sim.el("M-pad").textContent, "→ 512 (aligned)");
  assert.doesNotMatch(sim.el("M-pad").className, /waste/);
});

test("gradient-descent-explorer: a too-big learning rate still shows the blow-up and completes the checkpoint", () => {
  const sim = loadSim("gradient-descent-explorer");
  sim.run("render()");
  sim.input("lr", 0.3);
  assert.match(sim.el("note").innerHTML, /too big/);
  assert.ok(sim.events.includes("checkpoint:observe-divergence"));
});

test("consistent-hash-ring: changing vnodes redraws the ring and the readout", () => {
  const sim = loadSim("consistent-hash-ring");
  sim.run("reset(); render()");
  sim.input("rep", 4);
  assert.match(sim.el("readout").innerHTML, /Virtual nodes per node: 4/);
  assert.equal((sim.el("ring").innerHTML.match(/<title>[ABC]<\/title>/g) ?? []).length, 12); // 3 nodes × 4 vnodes
});
