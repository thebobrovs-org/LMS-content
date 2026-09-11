// LMS-content#59: moving a slider must not rebuild it. Five sims used to rewrite the
// markup holding their range inputs on every input event, so keyboard users lost focus
// after one arrow press and mouse drags were cut short. Each real main.js runs in a
// Node vm with a small fake DOM: it records every innerHTML write and every listener,
// and it finds the inputs and buttons in the markup written so far (and in the sim's
// static index.html), so tests drive the real handlers. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

/**
 * A fake DOM. Elements are looked up by id and stay the same object, the way a real
 * element does until markup replaces it. Every innerHTML write is recorded, so a test
 * can see whether a slider's markup was written again.
 */
function fakeDom() {
  const writes = []; // { key, html }, in order
  const els = new Map();
  const doc = {
    getElementById: (id) => el(id),
    querySelector: (sel) => el(sel.startsWith("#") ? sel.slice(1) : sel),
    querySelectorAll: (sel) => select(sel),
    documentElement: { dataset: {} },
    body: { scrollHeight: 0 },
    addEventListener() {},
  };
  function make(key, attrs) {
    let html = "";
    const classes = new Set((attrs.class ?? "").split(/\s+/).filter(Boolean));
    const dataset = Object.fromEntries(
      Object.entries(attrs)
        .filter(([name]) => name.startsWith("data-"))
        .map(([name, value]) => [name.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase()), value]),
    );
    return {
      id: key,
      listeners: {},
      value: "",
      textContent: "",
      className: "",
      hidden: false,
      style: {},
      dataset,
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
        toggle: (c, force) => {
          const on = force ?? !classes.has(c);
          if (on) classes.add(c); else classes.delete(c);
          return on;
        },
      },
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
      getAttribute: (name) => attrs[name] ?? null,
      querySelector: (sel) => doc.querySelector(sel),
      querySelectorAll: (sel) => doc.querySelectorAll(sel),
      get innerHTML() { return html; },
      set innerHTML(value) { html = String(value); writes.push({ key, html }); },
    };
  }
  function el(key, attrs = {}) {
    if (!els.has(key)) els.set(key, make(key, attrs));
    return els.get(key);
  }
  const markup = () => [...els.values()].map((e) => e.innerHTML).join("\n");
  const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  /** The selectors these sims use: "… input", ".presets button", and single classes on buttons. */
  function select(sel) {
    const html = markup();
    if (/\binput$/.test(sel)) return [...new Set([...html.matchAll(/<input[^>]*\bid="([^"]+)"/g)].map((m) => m[1]))].map((id) => el(id));
    // Buttons are identified by their position in the markup, which these sims never reorder.
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((m, n) => el(`button:${n}`, attrsOf(m[0])));
    if (sel === ".presets button") return buttons.filter((b) => b.getAttribute("data-l") !== null);
    if (/^\.[\w-]+$/.test(sel)) return buttons.filter((b) => b.classList.contains(sel.slice(1)));
    return [];
  }
  return { doc, el, writes };
}

function loadSim(id) {
  const { doc, el, writes } = fakeDom();
  // The static page around the sim (e.g. matmul-tiler's tile switch lives in index.html).
  const page = fs.readFileSync(path.join(PACKAGES, id, "index.html"), "utf8");
  el("page").innerHTML = (page.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? "").replace(/<script[\s\S]*?<\/script>/g, "");
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
  const fire = (target, type) => {
    // A snapshot: a render that wires the element again mustn't feed this loop forever.
    const fns = [...(target.listeners[type] ?? [])];
    assert.ok(fns.length > 0, `${target.id} has no ${type} listener`);
    for (const fn of fns) fn({ target });
  };
  return {
    run: (code) => vm.runInContext(code, context),
    el,
    writes,
    events,
    checkpoints: () => events.filter((e) => e.startsWith("checkpoint:")),
    buttons: (sel) => doc.querySelectorAll(sel),
    /** Move a slider the way an arrow key or a drag does: set its value and fire its input listeners. */
    input(sliderId, value) {
      const slider = el(sliderId);
      slider.value = String(value);
      fire(slider, "input");
    },
    /** Click the button matching `sel` for which `pick` is true, through its registered handlers. */
    click(sel, pick) {
      const button = doc.querySelectorAll(sel).find(pick);
      assert.ok(button, `no ${sel} button matches`);
      fire(button, "click");
    },
  };
}

/** Keys of the elements whose markup was rewritten with a slider in it since write number `from`. */
const rebuilt = (sim, from) => sim.writes.slice(from).filter((w) => /type="range"/.test(w.html)).map((w) => w.key);

// Every slider in every sim the issue lists.
const CASES = [
  { id: "consistent-hash-ring", start: "reset(); render()", slider: "rep", moves: [3, 4], label: ["rep-val", "4"] },
  { id: "gradient-descent-explorer", start: "render()", slider: "lr", moves: [0.2, 0.3], label: ["lr-val", "0.300"] },
  { id: "gradient-descent-explorer", start: "render()", slider: "mu", moves: [0.5, 0.6], label: ["mu-val", "0.60"] },
  { id: "number-format-explorer", start: "render()", slider: "L", moves: [4.5, 5], label: ["L-val", "1.0e+5"] },
  { id: "arithmetic-intensity-calculator", start: "render()", slider: "b", moves: [300, 512], label: ["b-val", "512"] },
  { id: "arithmetic-intensity-calculator", start: "render()", slider: "f", moves: [1000, 2048], label: ["f-val", "2048"] },
  { id: "matmul-tiler", start: "render()", slider: "s-M", moves: [400, 500], label: ["M-val", "500"] },
  { id: "matmul-tiler", start: "render()", slider: "s-K", moves: [300, 384], label: ["K-val", "384"] },
  { id: "matmul-tiler", start: "render()", slider: "s-N", moves: [700, 640], label: ["N-val", "640"] },
];

for (const c of CASES) {
  test(`${c.id} #${c.slider}: moving the slider updates the outputs in place, without rebuilding it`, () => {
    const sim = loadSim(c.id);
    sim.run(c.start);
    const afterMount = sim.writes.length;
    for (const v of c.moves) sim.input(c.slider, v); // two steps, like pressing → twice
    assert.ok(sim.writes.length > afterMount, "the outputs were redrawn");
    assert.deepEqual(rebuilt(sim, afterMount), [], "a slider's markup was written again");
    assert.equal(sim.el(c.label[0]).textContent, c.label[1], "the value label follows the slider");
    assert.equal(sim.el(c.slider).listeners.input.length, 1, "the slider is wired once, not on every render");
  });
}

test("number-format-explorer: a preset button moves the slider and the label without rebuilding them", () => {
  const sim = loadSim("number-format-explorer");
  sim.run("render()");
  const afterMount = sim.writes.length;
  sim.click(".presets button", (b) => b.getAttribute("data-l") === "-7");
  assert.equal(sim.el("L").value, "-7");
  assert.equal(sim.el("L-val").textContent, "1.0e-7");
  assert.deepEqual(rebuilt(sim, afterMount), []);
});

test("number-format-explorer: moving to 1e5 completes the checkpoint, through fp16 overflow", () => {
  const sim = loadSim("number-format-explorer");
  sim.run("render()");
  assert.deepEqual(sim.checkpoints(), [], "nothing overflows at 10^0");
  sim.input("L", 5);
  assert.deepEqual(sim.checkpoints(), ["checkpoint:observe-overflow"]);
  assert.match(sim.el("readout").innerHTML, /fp16 can't hold this value/);
});

test("arithmetic-intensity-calculator: the tile buttons switch the tile and their highlight in place", () => {
  const sim = loadSim("arithmetic-intensity-calculator");
  sim.run("render()");
  sim.input("f", 300);
  const afterSlider = sim.writes.length;
  sim.click(".t", (b) => b.getAttribute("data-t") === "256");
  assert.equal(sim.run("tile"), 256);
  const [t128, t256] = sim.buttons(".t");
  assert.equal(t256.classList.contains("on"), true);
  assert.equal(t128.classList.contains("on"), false);
  assert.match(sim.el("pad").innerHTML, /256×512/, "F = 300 pads to 512 on a 256 tile");
  assert.deepEqual(rebuilt(sim, afterSlider), []);
});

test("matmul-tiler: the tile switch and the sliders update each padded size in place", () => {
  const sim = loadSim("matmul-tiler");
  sim.run("render()");
  const afterMount = sim.writes.length;
  sim.input("s-M", 300);
  assert.equal(sim.el("M-pad").textContent, "→ 384");
  assert.match(sim.el("M-pad").className, /waste/);
  sim.click(".seg-btn", (b) => b.dataset.tile === "256");
  assert.equal(sim.run("T"), 256);
  assert.equal(sim.el("M-pad").textContent, "→ 512");
  assert.equal(sim.el("K-pad").textContent, "→ 512 (aligned)");
  assert.doesNotMatch(sim.el("K-pad").className, /waste/);
  assert.deepEqual(rebuilt(sim, afterMount), []);
});

test("gradient-descent-explorer: a too-big learning rate still shows the blow-up and completes the checkpoint", () => {
  const sim = loadSim("gradient-descent-explorer");
  sim.run("render()");
  assert.deepEqual(sim.checkpoints(), []);
  sim.input("lr", 0.3);
  assert.match(sim.el("note").innerHTML, /too big/);
  assert.deepEqual(sim.checkpoints(), ["checkpoint:observe-divergence"]);
});

test("consistent-hash-ring: changing vnodes redraws the ring and the readout", () => {
  const sim = loadSim("consistent-hash-ring");
  sim.run("reset(); render()");
  sim.input("rep", 4);
  assert.match(sim.el("readout").innerHTML, /Virtual nodes per node: 4/);
  assert.equal((sim.el("ring").innerHTML.match(/<title>[ABC]<\/title>/g) ?? []).length, 12); // 3 nodes × 4 vnodes
});
