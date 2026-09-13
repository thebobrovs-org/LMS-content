// LMS-content#98, the behaviour behind aria-structure.test.mjs: in the three step explorers
// exactly one step button carries aria-current="step", and it moves with the step; in the TPU
// VM anatomy a key press on a unit selects that unit once and never bubbles on to the
// TensorCore frame it sits in. Each real main.js runs in a Node vm on a small fake DOM that
// keeps one object per element of the markup the sim writes (so attributes set later are seen),
// answers the few selectors these sims use, and shrugs at everything else (canvas, layout).
// Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");

/** A value that accepts any property access or call and returns more of itself (canvas contexts, layout). */
function anything() {
  const fn = () => proxy;
  const proxy = new Proxy(fn, {
    get: (_t, prop) => (prop === Symbol.toPrimitive ? () => 0 : prop === "then" ? undefined : proxy),
    set: () => true,
    apply: () => proxy,
  });
  return proxy;
}

function fakeDom() {
  const byKey = new Map(); // one object per element, by id, else by host and ordinal
  const hosts = new Map(); // host key → the elements parsed from its latest innerHTML, in order, with spans
  const roots = []; // hosts that no markup contains (the sim's root, created elements), in creation order
  let created = 0;
  const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const classesOf = (attrs) => new Set((attrs.class ?? "").split(/\s+/).filter(Boolean));

  function make(key, tag) {
    const state = { attrs: {}, classes: new Set(), listeners: {}, html: "", text: "", span: [0, 0], host: null, children: [] };
    const el = {
      key,
      tagName: tag.toUpperCase(),
      style: {},
      get listeners() { return state.listeners; },
      addEventListener(type, fn) { (state.listeners[type] ??= []).push(fn); },
      removeEventListener() {},
      getAttribute: (n) => (n in state.attrs ? state.attrs[n] : null),
      setAttribute(n, v) { state.attrs[n] = String(v); if (n === "class") state.classes = classesOf(state.attrs); },
      removeAttribute(n) { delete state.attrs[n]; },
      hasAttribute: (n) => n in state.attrs,
      get dataset() { return Object.fromEntries(Object.entries(state.attrs).filter(([n]) => n.startsWith("data-")).map(([n, v]) => [n.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase()), v])); },
      classList: {
        add: (c) => state.classes.add(c),
        remove: (c) => state.classes.delete(c),
        contains: (c) => state.classes.has(c),
        toggle: (c, force) => { const on = force ?? !state.classes.has(c); if (on) state.classes.add(c); else state.classes.delete(c); return on; },
      },
      get className() { return [...state.classes].join(" "); },
      set className(v) { state.classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
      get textContent() { return state.text; },
      set textContent(v) { state.text = String(v); },
      get innerText() { return state.text; },
      set innerText(v) { state.text = String(v); },
      get innerHTML() { return state.html; },
      set innerHTML(v) { state.html = String(v); parse(key, state.html); },
      querySelector: (sel) => select(sel, key)[0] ?? null,
      querySelectorAll: (sel) => select(sel, key),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
      appendChild(child) { child._state.host = key; state.children.push(child); const i = roots.indexOf(child.key); if (i >= 0) roots.splice(i, 1); return child; },
      append(...children) { for (const c of children) if (typeof c !== "string") this.appendChild(c); },
      removeChild(child) { state.children = state.children.filter((c) => c !== child); return child; },
      remove() {},
      _state: state,
    };
    const proxy = new Proxy(el, { get: (t, p) => (p in t ? t[p] : anything()), set: (t, p, v) => { if (p === "id") { byKey.set(String(v), proxy); state.attrs.id = String(v); } t[p] = v; return true; } });
    return proxy;
  }

  /** A host's innerHTML was set: its elements are (re)created, as in a real DOM, and any host inside it is stale. */
  function parse(hostKey, html) {
    const list = [];
    const seen = {};
    for (const m of html.matchAll(/<(\w+)\b([^>]*)>/g)) {
      const tag = m[1];
      const attrs = attrsOf(m[2]);
      const key = attrs.id ?? `${hostKey}/${tag}#${(seen[tag] = (seen[tag] ?? 0) + 1)}`;
      if (!byKey.has(key)) byKey.set(key, make(key, tag));
      const el = byKey.get(key);
      const st = el._state;
      st.attrs = { ...attrs }; st.classes = classesOf(attrs); st.listeners = {}; st.host = hostKey;
      // The element's span in this html: to its matching close, for scoping.
      let depth = 1; const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g"); re.lastIndex = m.index + m[0].length; let end = html.length;
      for (let t = re.exec(html); t; t = re.exec(html)) { if (t[0].endsWith("/>")) continue; depth += t[1] ? -1 : 1; if (depth === 0) { end = t.index; break; } }
      st.span = [m.index, end];
      if (hosts.has(key)) hosts.delete(key); // written by its parent now: its own old markup is gone
      list.push(el);
    }
    hosts.set(hostKey, list);
  }
  /** The live elements under a host, in document order: a host inside it contributes its own fresh markup. */
  function emit(hostKey, out = []) {
    const list = hosts.get(hostKey) ?? [];
    let skipUntil = -1;
    for (const el of list) {
      if (el._state.span[0] < skipUntil) continue;
      out.push(el);
      if (hosts.has(el.key) || el._state.children.length) { skipUntil = el._state.span[1]; emit(el.key, out); }
    }
    for (const c of byKey.get(hostKey)?._state.children ?? []) { out.push(c); emit(c.key, out); }
    return out;
  }
  /** `.class`, `[data-x]`, `[data-x="v"]`, `#id`, `tag`, within a host or (no host) the whole document. */
  function select(sel, scope) {
    const m = sel.match(/^(?:(\w+)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\])$/);
    if (!m) return [];
    let pool;
    if (scope === undefined) pool = roots.flatMap((r) => emit(r));
    else if (hosts.has(scope) || byKey.get(scope)?._state.children.length) pool = emit(scope);
    else { const el = byKey.get(scope); const all = el?._state.host ? emit(el._state.host) : []; const i = all.indexOf(el); pool = i < 0 ? [] : all.slice(i + 1).filter((e) => e._state.host === el._state.host ? e._state.span[0] < el._state.span[1] : true); }
    return pool.filter((el) => (m[1] ? el.tagName === m[1].toUpperCase() : m[2] ? el.classList.contains(m[2]) : m[3] ? el.getAttribute("id") === m[3] : m[5] !== undefined ? el.getAttribute(m[4]) === m[5] : el.getAttribute(m[4]) !== null));
  }
  function root(key, tag) {
    if (!byKey.has(key)) { byKey.set(key, make(key, tag)); roots.push(key); hosts.set(key, []); }
    return byKey.get(key);
  }
  const doc = new Proxy({
    getElementById: (id) => byKey.get(id) ?? root(id, "div"),
    querySelector: (sel) => select(sel)[0] ?? null,
    querySelectorAll: (sel) => select(sel),
    documentElement: { dataset: {} },
    body: { scrollHeight: 0 },
    addEventListener() {},
    createElement: (tag) => root(`created:${tag}:${++created}`, tag),
  }, { get: (t, p) => (p in t ? t[p] : anything()) });
  return { doc, select: (sel) => select(sel), byKey };
}

function loadSim(id) {
  const { doc, select } = fakeDom();
  const events = [];
  const g = {
    document: doc,
    console,
    requestAnimationFrame: () => 0,
    setTimeout: () => 0,
    clearTimeout: () => {},
    clearInterval: () => {},
    setInterval: () => 0,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    ResizeObserver: class { observe() {} disconnect() {} },
    devicePixelRatio: 1,
    getComputedStyle: () => anything(),
    createSim: ({ onInit }) => {
      const sim = { checkpoint: (c) => events.push({ checkpoint: c }), event: (name, payload) => events.push({ name, payload }), resize() {}, isInitialized: () => true, _onInit: onInit };
      return sim;
    },
  };
  g.window = g;
  const context = vm.createContext(g);
  const file = path.join(PACKAGES, id, "main.js");
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return {
    run: (code) => vm.runInContext(code, context),
    /** Start the sim the way the host does. */
    init: () => vm.runInContext(`window.sim._onInit({ theme: "light", reducedMotion: true })`, context),
    select,
    events,
    /** Fire `type` on an element through its registered handlers, with a bubbling-aware event. */
    fire(el, type, init = {}) {
      const ev = { type, target: el, key: init.key, stopped: false, prevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
      for (const fn of [...(el.listeners[type] ?? [])]) fn(ev);
      return ev;
    },
  };
}

const current = (buttons) => buttons.map((b, i) => (b.getAttribute("aria-current") === "step" ? i : null)).filter((i) => i !== null);

for (const [id, second] of [["training-loop-explorer", 2], ["backprop-explorer", 3], ["image-tensor-explorer", 1]]) {
  test(`${id}: exactly one step button is aria-current="step", and it follows the step`, () => {
    const sim = loadSim(id);
    sim.init();
    const buttons = sim.select(".step-btn");
    assert.ok(buttons.length >= 4, `${buttons.length} step buttons`);
    assert.deepEqual(current(buttons), [0], "the first step is current after start-up");
    assert.equal(buttons[0].classList.contains("active"), true);
    sim.fire(buttons[second], "click");
    assert.deepEqual(current(buttons), [second], `step ${second} is current after activating it`);
    assert.equal(buttons[0].classList.contains("active"), false, "the first step lost its highlight");
    sim.fire(buttons[0], "click");
    assert.deepEqual(current(buttons), [0], "and back");
  });
}

test("tpu-vm-anatomy: Enter on a unit selects that unit once; the TensorCore frame takes no key presses", () => {
  const sim = loadSim("tpu-vm-anatomy");
  sim.init();
  const frame = sim.select('[data-part="tensorcore"]').find((el) => el.getAttribute("tabindex") === null);
  const label = sim.select('[data-part="tensorcore"]').find((el) => el.getAttribute("tabindex") === "0");
  assert.ok(frame && label, "a non-focusable frame and a focusable label, both for the TensorCore");
  assert.equal(frame.getAttribute("role"), "group");
  assert.equal(label.getAttribute("role"), "button");
  assert.equal(frame.listeners.keydown, undefined, "the frame has no keydown handler to bubble into");
  assert.ok(frame.listeners.click?.length, "the frame still selects on click, for the mouse");

  const inspects = () => sim.events.filter((e) => e.name === "inspect").map((e) => e.payload.part);
  const mxu = sim.select('[data-part="mxu"]')[0];
  const before = inspects().length;
  const ev = sim.fire(mxu, "keydown", { key: "Enter" });
  assert.equal(ev.stopped, true, "the key press stops at the unit");
  assert.equal(ev.prevented, true);
  assert.deepEqual(inspects().slice(before), ["mxu"], "one selection, of the unit itself");
  assert.equal(sim.run("selected"), "mxu");

  // The label selects the whole TensorCore, once.
  const n = inspects().length;
  sim.fire(sim.select('[data-part="tensorcore"]').find((el) => el.getAttribute("tabindex") === "0"), "keydown", { key: " " });
  assert.deepEqual(inspects().slice(n), ["tensorcore"]);
  assert.equal(sim.run("selected"), "tensorcore");

  // A key that is not Enter or Space does nothing and is not swallowed.
  const m = inspects().length;
  const tab = sim.fire(sim.select('[data-part="vpu"]')[0], "keydown", { key: "Tab" });
  assert.equal(tab.stopped, false);
  assert.equal(inspects().length, m);
});
