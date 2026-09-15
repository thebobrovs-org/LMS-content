// LMS-content#100: picking a tab never rebuilds the tab controls, so the tab a keyboard user
// pressed stays the same element and keeps focus (sliders had the same fault, #59). A tab list
// moves with the arrow keys, Home and End; the topology view, drawn on a canvas, turns with the
// arrow keys as it does with a drag. Each real main.js runs in a Node vm with a small fake DOM:
// the markup a sim writes is read for its buttons (by id, data attribute or class), elements stay
// the same object, every innerHTML write is recorded so a test can see whether a button or the
// canvas was written again, and listeners are recorded so tests drive the real handlers.
// Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");
const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

function fakeDom() {
  const writes = []; // { key, html }, in order
  const els = new Map();
  let active = null;
  const noop = () => {};
  const context2d = new Proxy({}, { get: () => noop });
  function make(key, attrs = {}) {
    let html = "";
    const classes = new Set((attrs.class ?? "").split(/\s+/).filter(Boolean));
    const element = {
      id: key,
      attrs: { ...attrs },
      listeners: {},
      children: [],
      value: "",
      textContent: "",
      className: "",
      disabled: false,
      style: {},
      scrollTop: 0,
      scrollHeight: 0,
      clientWidth: 600,
      clientHeight: 400,
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c),
        toggle: (c, force) => {
          const on = force ?? !classes.has(c);
          if (on) classes.add(c);
          else classes.delete(c);
          return on;
        },
      },
      addEventListener(type, fn) {
        (this.listeners[type] ??= []).push(fn);
      },
      getAttribute(name) {
        return this.attrs[name] ?? null;
      },
      setAttribute(name, value) {
        this.attrs[name] = String(value);
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      focus() {
        active = this;
      },
      getContext: () => context2d,
      querySelector: (sel) => doc.querySelector(sel),
      querySelectorAll: (sel) => doc.querySelectorAll(sel),
      get innerHTML() {
        return html;
      },
      set innerHTML(value) {
        html = String(value);
        writes.push({ key, html });
      },
    };
    return element;
  }
  const markup = () => [...els.values()].map((e) => e.innerHTML).join("\n");
  /** An element by key; one first looked up by id takes the attributes its tag has in the markup written so far, as a real element would. */
  function el(key, attrs) {
    if (!els.has(key)) {
      const tag = attrs ? null : [...markup().matchAll(/<\w+\b[^>]*>/g)].map((m) => m[0]).find((t) => attrsOf(t).id === key);
      els.set(key, make(key, attrs ?? (tag ? attrsOf(tag) : {})));
    }
    return els.get(key);
  }
  /** The buttons in the markup written so far, each keyed by its id, its data attribute, or its position. */
  function buttons() {
    return [...markup().matchAll(/<button\b[^>]*>/g)].map((m, n) => {
      const attrs = attrsOf(m[0]);
      const data = Object.keys(attrs).find((a) => a.startsWith("data-"));
      return el(attrs.id ?? (data ? `button[${data}=${attrs[data]}]` : `button:${n}`), attrs);
    });
  }
  function select(sel) {
    if (sel.startsWith("#")) return [el(sel.slice(1))];
    const attr = /^\[([\w-]+)\]$/.exec(sel);
    if (attr) return buttons().filter((b) => b.getAttribute(attr[1]) !== null);
    const cls = /^\.([\w-]+)$/.exec(sel);
    if (cls) return buttons().filter((b) => b.classList.contains(cls[1]));
    return [];
  }
  const doc = {
    get activeElement() {
      return active;
    },
    documentElement: { dataset: {} },
    body: { scrollHeight: 0 },
    visibilityState: "visible",
    addEventListener: noop,
    createElement: (tag) => make(`created:${tag}`),
    getElementById: (id) => el(id),
    querySelector: (sel) => select(sel)[0] ?? null,
    querySelectorAll: (sel) => select(sel),
  };
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
    setInterval: () => 0,
    clearInterval: () => {},
    matchMedia: () => ({ matches: false }),
    performance: { now: () => 0 },
    devicePixelRatio: 1,
    addEventListener: () => {},
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
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
  const fire = (target, type, init = {}) => {
    const fns = [...(target.listeners[type] ?? [])]; // a snapshot: a handler that wires again mustn't feed this loop
    assert.ok(fns.length > 0, `${target.id} has no ${type} listener`);
    const event = { target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...init };
    for (const fn of fns) fn(event);
    return event;
  };
  return {
    doc,
    el,
    writes,
    run: (code) => vm.runInContext(code, context),
    checkpoints: () => events.filter((e) => e.startsWith("checkpoint:")),
    click(sel, pick) {
      const button = doc.querySelectorAll(sel).find(pick);
      assert.ok(button, `no ${sel} button matches`);
      return fire(button, "click");
    },
    key: (target, key) => fire(target, "keydown", { key }),
  };
}

/** The writes since write number `from` whose markup holds a button or a canvas: a control built again. */
const rebuilt = (sim, from) => sim.writes.slice(from).filter((w) => /<(button|canvas)\b/.test(w.html)).map((w) => w.key);

test("tpu-consumption-explorer: a path or a workload shape moves the pressed state and redraws the panels, without building a button again", () => {
  const sim = loadSim("tpu-consumption-explorer");
  sim.run("render()");
  const afterMount = sim.writes.length;
  const pressed = (sel) => sim.doc.querySelectorAll(sel).map((b) => [b.getAttribute("aria-pressed"), b.classList.contains("on")]);
  assert.deepEqual(pressed("[data-p]"), [["true", true], ["false", false], ["false", false]]);
  assert.deepEqual(pressed("[data-h]"), [["true", true], ["false", false], ["false", false]]);
  sim.click("[data-p]", (b) => b.getAttribute("data-p") === "1");
  assert.deepEqual(pressed("[data-p]"), [["false", false], ["true", true], ["false", false]]);
  assert.match(sim.el("stack").innerHTML, /GKE — auto provision/);
  assert.equal(sim.el("use").textContent, "Production training & serving at scale — containerized, orchestrated, multi-host.");
  assert.deepEqual(sim.checkpoints(), ["checkpoint:observe-consumption"]);
  sim.click("[data-h]", (b) => b.getAttribute("data-h") === "1");
  assert.deepEqual(pressed("[data-h]"), [["false", false], ["true", true], ["false", false]]);
  assert.equal((sim.el("hostrow").innerHTML.match(/class="hostvm"/g) ?? []).length, 3, "a multi-host slice spans three VMs");
  assert.match(sim.el("hdesc").textContent, /spanning several VMs/);
  assert.deepEqual(rebuilt(sim, afterMount), []);
  assert.equal(sim.doc.querySelectorAll("[data-p]")[1].listeners.click.length, 1, "each button is wired once, not on every render");
});

test("systolic-array: the tab list is built once; the arrow keys, Home and End move the selection, the focus and the Tab order, and only the panel is written", () => {
  const sim = loadSim("systolic-array");
  sim.run("render()");
  const why = sim.el("tab-why");
  const array = sim.el("tab-array");
  const state = () => [why, array].map((t) => [t.getAttribute("aria-selected"), t.getAttribute("tabindex"), t.classList.contains("active")]);
  assert.deepEqual(state(), [["true", "0", true], ["false", "-1", false]]);
  const afterMount = sim.writes.length;
  assert.equal(sim.key(why, "ArrowRight").defaultPrevented, true);
  assert.equal(sim.run("mode"), "array");
  assert.equal(sim.doc.activeElement, array, "focus follows the selected tab");
  assert.deepEqual(state(), [["false", "-1", false], ["true", "0", true]]);
  assert.equal(sim.el("panel").getAttribute("aria-labelledby"), "tab-array");
  assert.match(sim.el("panel").innerHTML, /id="step"/, "the How panel, with its controls");
  sim.key(array, "Home");
  assert.deepEqual([sim.run("mode"), sim.doc.activeElement], ["why", why]);
  sim.key(why, "End");
  assert.deepEqual([sim.run("mode"), sim.doc.activeElement], ["array", array]);
  sim.key(array, "ArrowRight");
  assert.equal(sim.run("mode"), "why", "the arrows wrap around");
  sim.key(why, "ArrowLeft");
  assert.equal(sim.run("mode"), "array");
  assert.equal(sim.key(array, "a").defaultPrevented, false, "other keys are left alone");
  sim.click("#tab-why", () => true);
  assert.equal(sim.run("mode"), "why", "a click still switches");
  assert.deepEqual([...new Set(rebuilt(sim, afterMount))], ["panel"], "only the panel's own controls are written again, never a tab");
  assert.doesNotMatch(sim.writes.slice(afterMount).map((w) => w.html).join("\n"), /role="tab"/);
});

test("systolic-array: the How view still steps through its own button after a keyboard switch", () => {
  const sim = loadSim("systolic-array");
  sim.run("render()");
  sim.key(sim.el("tab-why"), "ArrowRight");
  sim.click("#step", () => true);
  assert.equal(sim.run("cycle"), 1);
  assert.equal(sim.el("m-cycle").textContent, 1);
});

test("tpu-topology-explorer: a tab updates the pressed state, the readout and the chart without building the tabs or the canvas again; the arrow keys turn the view as a drag does and Home resets it", () => {
  const sim = loadSim("tpu-topology-explorer");
  sim.run("start()");
  const afterMount = sim.writes.length;
  const canvas = sim.el("c");
  assert.equal(canvas.getAttribute("tabindex"), "0");
  assert.match(canvas.getAttribute("aria-label"), /^3D view of the .+ mesh, \d+ hops across\. Arrow keys rotate; Home resets the view\.$/);
  const pressedAt = () => sim.doc.querySelectorAll(".tab").findIndex((b) => b.getAttribute("aria-pressed") === "true");
  assert.equal(pressedAt(), 1, "it opens on the 3D torus");
  sim.click(".tab", (b) => b.getAttribute("data-i") === "2");
  assert.equal(pressedAt(), 2);
  assert.deepEqual(sim.checkpoints(), ["checkpoint:observe-topology"]);
  const name = sim.run("TOPOLOGIES[2].name");
  assert.match(sim.el("readout").innerHTML, new RegExp(`<div class="r-title">${name}</div>`));
  assert.match(sim.el("chart").innerHTML, /Max hops/);
  assert.ok(canvas.getAttribute("aria-label").includes(name), "the canvas names the topology shown");
  assert.deepEqual(rebuilt(sim, afterMount), []);
  assert.equal(canvas.listeners.pointerdown.length, 1, "the canvas is wired once");
  const [yaw, pitch] = [sim.run("yaw"), sim.run("pitch")];
  assert.equal(sim.key(canvas, "ArrowRight").defaultPrevented, true);
  assert.ok(sim.run("yaw") > yaw, "right turns the view as dragging right does");
  sim.key(canvas, "ArrowLeft");
  sim.key(canvas, "ArrowLeft");
  assert.ok(sim.run("yaw") < yaw);
  sim.key(canvas, "ArrowUp");
  assert.ok(sim.run("pitch") < pitch);
  for (let n = 0; n < 40; n++) sim.key(canvas, "ArrowDown");
  assert.equal(sim.run("pitch"), Math.PI / 2, "clamped as a drag is");
  sim.key(canvas, "Home");
  assert.deepEqual([sim.run("yaw"), sim.run("pitch")], [-0.5, -0.4]);
  assert.equal(sim.key(canvas, "Tab").defaultPrevented, false, "Tab still leaves the canvas");
});
