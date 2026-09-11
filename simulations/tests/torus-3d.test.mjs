// LMS-content#60: torus-3d's checkpoint must be reachable without a pointer, and the
// canvas must redraw when its size changes. The real main.js runs in a Node vm with a
// small fake DOM: the markup the sim writes is parsed for its elements, listeners are
// recorded so tests drive the real handlers, the canvas records its size and draw
// calls, and the ResizeObserver hands its callback to the test. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

function loadSim() {
  const events = [];
  const observed = []; // { callback, target } per ResizeObserver
  const draws = []; // canvas context calls that depend on the size
  const els = new Map();
  const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const element = (id, attrs = {}) => {
    if (!els.has(id)) {
      let html = "";
      els.set(id, {
        id,
        attrs,
        writes: 0, // innerHTML assignments
        listeners: {},
        value: "",
        clientWidth: 600,
        clientHeight: 380,
        width: 0,
        height: 0,
        addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
        getAttribute(name) { return this.attrs[name] ?? null; },
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        getContext: () => new Proxy({}, { get: (_, key) => (key === "clearRect" ? (...a) => draws.push(a) : () => {}) }),
        get innerHTML() { return html; },
        set innerHTML(v) {
          html = String(v);
          this.writes += 1;
          // The elements in this markup, with their attributes.
          for (const m of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) element(m[2], attrsOf(m[0]));
        },
      });
    }
    return els.get(id);
  };
  const app = element("app");
  app.querySelector = (sel) => element(sel.replace(/^#/, ""));
  const g = {
    document: { getElementById: () => app, documentElement: { dataset: {}, style: {} }, body: { scrollHeight: 400 } },
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    console,
    requestAnimationFrame: (cb) => cb(),
    setTimeout: () => 0,
    devicePixelRatio: 1,
    addEventListener() {},
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(target) { observed.push({ callback: this.callback, target }); }
      disconnect() {}
    },
    createSim: ({ onInit }) => {
      g.init = () => onInit({ props: { n: 2 }, theme: "light" });
      return { checkpoint: (c) => events.push(`checkpoint:${c}`), event: (name) => events.push(name), resize() {}, isInitialized: () => true };
    },
  };
  g.window = g;
  const context = vm.createContext(g);
  const file = path.join(PACKAGES, "torus-3d", "main.js");
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  g.init(); // a 2×2×2 torus: 8 chips
  const fire = (target, type, event = {}) => {
    const fns = target.listeners[type] ?? [];
    assert.ok(fns.length > 0, `${target.id} has no ${type} listener`);
    for (const fn of fns) fn({ target, preventDefault() {}, ...event });
  };
  return {
    run: (code) => vm.runInContext(code, context),
    el: element,
    events,
    observed,
    draws,
    checkpoints: () => events.filter((e) => e.startsWith("checkpoint:")),
    key: (key, event = {}) => fire(element("c"), "keydown", { key, ...event }),
    pick(value) {
      element("chip").value = value;
      fire(element("chip"), "change");
    },
  };
}

test("torus-3d: the canvas is focusable and describes its keys; the readout is announced", () => {
  const sim = loadSim();
  assert.equal(sim.el("c").getAttribute("tabindex"), "0");
  assert.match(sim.el("c").getAttribute("aria-label"), /Arrow keys rotate, Enter steps through the chips/);
  assert.equal(sim.el("readout").getAttribute("aria-live"), "polite");
});

test("torus-3d: picking a chip from the list selects it and completes the checkpoint", () => {
  const sim = loadSim();
  assert.match(sim.el("app").innerHTML, /<option value="7">\(1,1,1\)<\/option>/, "every chip is listed");
  assert.deepEqual(sim.checkpoints(), []);
  sim.pick("5");
  assert.equal(sim.run("selected"), 5);
  assert.deepEqual(sim.checkpoints(), ["checkpoint:inspect-neighbors"]);
  assert.match(sim.el("readout").innerHTML, /<b>Chip \(1,0,1\)<\/b> — 6 ICI neighbors/);
  sim.pick("");
  assert.equal(sim.run("selected"), null);
  assert.deepEqual(sim.checkpoints(), ["checkpoint:inspect-neighbors"], "the checkpoint latches once");
});

test("torus-3d: on the canvas, Enter steps through the chips, Escape clears, arrows and Home move the view", () => {
  const sim = loadSim();
  sim.key("Enter");
  assert.equal(sim.run("selected"), 0);
  assert.deepEqual(sim.checkpoints(), ["checkpoint:inspect-neighbors"]);
  assert.equal(sim.el("chip").value, "0", "the list follows the selection");
  sim.key("Enter");
  assert.equal(sim.run("selected"), 1);
  sim.key("Enter", { shiftKey: true });
  sim.key("Enter", { shiftKey: true });
  assert.equal(sim.run("selected"), 7, "Shift+Enter steps back, wrapping around");
  sim.key("Escape");
  assert.equal(sim.run("selected"), null);
  const yaw = sim.run("yaw"), pitch = sim.run("pitch");
  sim.key("ArrowRight");
  sim.key("ArrowDown");
  assert.ok(sim.run("yaw") > yaw && sim.run("pitch") > pitch, "the view rotates");
  // The readout is a live region: rotating with a chip selected redraws the canvas but doesn't re-announce it.
  sim.key("Enter");
  const announced = sim.el("readout").writes;
  assert.match(sim.el("readout").innerHTML, /<b>Chip \(0,0,0\)<\/b>/);
  sim.key("ArrowLeft");
  sim.key("ArrowUp");
  assert.equal(sim.el("readout").writes, announced, "a rotation leaves the readout untouched");
  sim.key("Enter");
  assert.equal(sim.el("readout").writes, announced + 1, "a new selection is announced once");
  sim.key("Home");
  assert.equal(sim.run("yaw"), yaw);
  assert.equal(sim.run("pitch"), pitch);
  for (let i = 0; i < 20; i++) sim.key("ArrowUp");
  assert.equal(sim.run("pitch"), -1.4, "pitch is clamped");
});

test("torus-3d: a render syncs the list with the selection, whichever input made it", () => {
  const sim = loadSim();
  sim.run("selected = 3; render()");
  assert.equal(sim.el("chip").value, "3");
});

test("torus-3d: the canvas redraws at its new size when it is resized", () => {
  const sim = loadSim();
  const canvas = sim.el("c");
  const resize = sim.observed.find((o) => o.target === canvas);
  assert.ok(resize, "a ResizeObserver watches the canvas");
  assert.equal(canvas.width, 600);
  canvas.clientWidth = 320;
  canvas.clientHeight = 200;
  const before = sim.draws.length;
  resize.callback([{ target: canvas }]);
  assert.equal(canvas.width, 320);
  assert.equal(canvas.height, 200);
  assert.deepEqual(sim.draws[sim.draws.length - 1], [0, 0, 320, 200], "the frame is cleared and drawn at the new size");
  assert.ok(sim.draws.length > before);
});
