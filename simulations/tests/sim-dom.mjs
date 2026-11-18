// The small DOM the simulation guards run each real main.js against, in a Node vm (LMS-content#135, moved here for
// #136 so more than one guard can use it; not a test itself). It behaves like a browser in the ways the guards need:
//   - writing innerHTML makes new elements from the markup, so an element from before is detached afterwards;
//   - document.activeElement is the body once the focused element is detached, disabled or hidden (display: none, or
//     the hidden attribute, on it or an ancestor), as the browser's focus fixup makes it;
//   - timers and animation frames run on a fake clock, so a step that plays out over time (a run, a compile) plays out.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const noop = () => {};

// ---- A small DOM ------------------------------------------------------------------------------------------------------

function parseAttrs(src) {
  const attrs = {};
  for (const m of src.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return attrs;
}

class TextNode {
  constructor(data) {
    this.nodeType = 3;
    this.data = data;
    this.parent = null;
  }
  get textContent() {
    return this.data;
  }
  serialize() {
    return this.data;
  }
}

class El {
  constructor(doc, tag, attrs = {}) {
    this.nodeType = 1;
    this.doc = doc;
    this.localName = tag.toLowerCase();
    this.tagName = tag.toUpperCase();
    this.attrs = new Map(Object.entries(attrs));
    this.childNodes = [];
    this.parent = null;
    this.listeners = {};
    this.style = {};
    this._value = undefined;
    this._checked = this.attrs.has("checked");
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.clientWidth = 600;
    this.clientHeight = 400;
    this.width = 0;
    this.height = 0;
    const self = this;
    this.dataset = new Proxy({}, {
      get: (_, k) => self.getAttribute("data-" + String(k).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())) ?? undefined,
      set: (_, k, v) => { self.setAttribute("data-" + String(k).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()), v); return true; },
      deleteProperty: (_, k) => { self.removeAttribute("data-" + String(k).replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())); return true; },
    });
    this.classList = {
      list: () => (self.getAttribute("class") ?? "").split(/\s+/).filter(Boolean),
      set: (l) => self.setAttribute("class", l.join(" ")),
      add: (...cs) => self.classList.set([...new Set([...self.classList.list(), ...cs])]),
      remove: (...cs) => self.classList.set(self.classList.list().filter((c) => !cs.includes(c))),
      contains: (c) => self.classList.list().includes(c),
      toggle: (c, force) => {
        const on = force ?? !self.classList.contains(c);
        if (on) self.classList.add(c);
        else self.classList.remove(c);
        return on;
      },
    };
  }
  getAttribute(n) {
    return this.attrs.has(n) ? this.attrs.get(n) : null;
  }
  setAttribute(n, v) {
    this.attrs.set(n, String(v));
  }
  removeAttribute(n) {
    this.attrs.delete(n);
  }
  hasAttribute(n) {
    return this.attrs.has(n);
  }
  get id() {
    return this.getAttribute("id") ?? "";
  }
  set id(v) {
    this.setAttribute("id", v);
  }
  get className() {
    return this.getAttribute("class") ?? "";
  }
  set className(v) {
    this.setAttribute("class", v);
  }
  get disabled() {
    return this.attrs.has("disabled");
  }
  set disabled(v) {
    if (v) this.setAttribute("disabled", "");
    else this.removeAttribute("disabled");
  }
  get hidden() {
    return this.attrs.has("hidden");
  }
  set hidden(v) {
    if (v) this.setAttribute("hidden", "");
    else this.removeAttribute("hidden");
  }
  get checked() {
    return this._checked;
  }
  set checked(v) {
    this._checked = !!v;
  }
  get value() {
    if (this._value !== undefined) return this._value;
    if (this.localName === "select") {
      const opts = this.querySelectorAll("option");
      return (opts.find((o) => o.hasAttribute("selected")) ?? opts[0])?.getAttribute("value") ?? "";
    }
    return this.getAttribute("value") ?? "";
  }
  set value(v) {
    this._value = String(v);
  }
  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }
  get parentElement() {
    return this.parent instanceof El ? this.parent : null;
  }
  get textContent() {
    return this.childNodes.map((n) => n.textContent).join("");
  }
  set textContent(v) {
    this.replaceChildren(new TextNode(String(v)));
  }
  get innerHTML() {
    return this.childNodes.map((n) => n.serialize()).join("");
  }
  set innerHTML(html) {
    this.replaceChildren(...this.doc.parse(String(html)));
  }
  serialize() {
    const attrs = [...this.attrs].map(([k, v]) => ` ${k}="${v}"`).join("");
    return VOID.has(this.localName) ? `<${this.localName}${attrs}>` : `<${this.localName}${attrs}>${this.innerHTML}</${this.localName}>`;
  }
  replaceChildren(...nodes) {
    for (const n of this.childNodes) n.parent = null;
    this.childNodes = [];
    for (const n of nodes) this.appendChild(n);
  }
  appendChild(n) {
    if (n.parent) n.parent.childNodes = n.parent.childNodes.filter((c) => c !== n);
    n.parent = this;
    this.childNodes.push(n);
    return n;
  }
  remove() {
    if (this.parent) this.parent.childNodes = this.parent.childNodes.filter((c) => c !== this);
    this.parent = null;
  }
  contains(other) {
    for (let n = other; n; n = n.parent) if (n === this) return true;
    return false;
  }
  get isConnected() {
    return this.doc.documentElement.contains(this);
  }
  descendants() {
    const out = [];
    const walk = (e) => { for (const c of e.children) { out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  querySelectorAll(sel) {
    return this.descendants().filter((e) => matches(e, sel, this));
  }
  querySelector(sel) {
    return this.querySelectorAll(sel)[0] ?? null;
  }
  closest(sel) {
    for (let n = this; n instanceof El; n = n.parent) if (matches(n, sel)) return n;
    return null;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  dispatch(type, extra = {}) {
    let stopped = false;
    const ev = { type, target: this, preventDefault: noop, stopPropagation: () => { stopped = true; }, clientX: 0, clientY: 0, ...extra };
    for (let n = this; n instanceof El && !stopped; n = n.parent) {
      ev.currentTarget = n;
      for (const fn of [...(n.listeners[type] ?? [])]) fn(ev);
    }
  }
  /** Whether the browser would let this element hold focus. */
  focusable() {
    if (!this.isConnected) return false;
    for (let n = this; n instanceof El; n = n.parent) if (n.style.display === "none" || n.hasAttribute("hidden")) return false;
    const control = ["button", "select", "textarea", "input"].includes(this.localName);
    if (control && this.disabled) return false;
    return control || (this.localName === "a" && this.hasAttribute("href")) || this.hasAttribute("tabindex");
  }
  focus() {
    if (this.focusable()) this.doc.active = this;
  }
  blur() {
    if (this.doc.active === this) this.doc.active = null;
  }
  getContext() {
    return new Proxy({}, { get: () => noop });
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
  }
  get scrollHeight() {
    return 0;
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  scrollIntoView() {}
}

/** Selector matching for what these sims use: tag, #id, .class, [attr], [attr="v"], compounds, descendants and lists. */
function matches(el, sel, scope = null) {
  return sel.split(",").some((one) => {
    const parts = one.trim().split(/\s+/);
    if (!compound(el, parts[parts.length - 1])) return false;
    let n = el.parent;
    for (let i = parts.length - 2; i >= 0; i--) {
      while (n instanceof El && n !== scope && !compound(n, parts[i])) n = n.parent;
      if (!(n instanceof El) || n === scope) return false;
      n = n.parent;
    }
    return true;
  });
}
function compound(el, sel) {
  const re = /^[a-zA-Z][\w-]*|#[\w-]+|\.[\w-]+|\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g;
  let m;
  let used = 0;
  while ((m = re.exec(sel))) {
    used += m[0].length;
    const t = m[0];
    if (t[0] === "#") { if (el.id !== t.slice(1)) return false; }
    else if (t[0] === ".") { if (!el.classList.contains(t.slice(1))) return false; }
    else if (t[0] === "[") {
      const v = m[2] ?? m[3] ?? m[4];
      if (!el.hasAttribute(m[1]) || (v !== undefined && el.getAttribute(m[1]) !== v)) return false;
    } else if (el.localName !== t.toLowerCase()) return false;
  }
  assert.equal(used, sel.length, `the test DOM doesn't understand the selector ${sel}`);
  return true;
}

function makeDocument() {
  const doc = {
    active: null,
    visibilityState: "visible",
    parse(html) {
      const root = new El(doc, "template");
      const stack = [root];
      const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+)/g;
      for (const m of html.matchAll(re)) {
        const top = stack[stack.length - 1];
        if (m[4] !== undefined) top.appendChild(new TextNode(m[4]));
        else if (m[2]) {
          const selfClosing = /\/\s*$/.test(m[3]);
          const el = new El(doc, m[2], parseAttrs(m[3].replace(/\/\s*$/, "")));
          top.appendChild(el);
          if (!selfClosing && !VOID.has(el.localName)) stack.push(el);
        } else if (m[1]) {
          const i = stack.map((e) => e.localName).lastIndexOf(m[1].toLowerCase());
          if (i > 0) stack.length = i;
        }
      }
      return [...root.childNodes];
    },
    get activeElement() {
      return doc.active && doc.active.focusable() ? doc.active : doc.body;
    },
    getElementById: (id) => doc.documentElement.querySelector(`#${id}`),
    querySelector: (sel) => doc.documentElement.querySelector(sel),
    querySelectorAll: (sel) => doc.documentElement.querySelectorAll(sel),
    createElement: (tag) => new El(doc, tag),
    createElementNS: (_, tag) => new El(doc, tag),
    addEventListener: noop,
    removeEventListener: noop,
  };
  doc.documentElement = new El(doc, "html");
  doc.body = doc.documentElement.appendChild(new El(doc, "body"));
  return doc;
}

// ---- A sim, running ---------------------------------------------------------------------------------------------------

async function loadSim(id, props = {}) {
  const doc = makeDocument();
  const page = fs.readFileSync(path.join(PACKAGES, id, "index.html"), "utf8");
  doc.body.innerHTML = (page.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? "").replace(/<script[\s\S]*?<\/script>/g, "");

  let clock = 0;
  let nextId = 1;
  let timers = []; // { id, at, fn, every }
  const schedule = (fn, ms, every) => {
    const id = nextId++;
    timers.push({ id, at: clock + Math.max(0, +ms || 0), fn, every: every ? Math.max(1, +ms || 0) : 0 });
    return id;
  };
  const cancel = (id) => { timers = timers.filter((t) => t.id !== id); };
  const flush = () => new Promise((r) => setImmediate(r));
  /** Let `ms` pass on the fake clock, running each timer and frame in order and every promise continuation between. */
  async function advance(ms) {
    const end = clock + ms;
    await flush();
    for (;;) {
      const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      clock = due.at;
      if (due.every) due.at += due.every;
      else cancel(due.id);
      due.fn();
      await flush();
    }
    clock = end;
  }

  let init = null;
  let initialized = false;
  const events = [];
  const g = {
    document: doc,
    console,
    Date,
    setTimeout: (fn, ms) => schedule(fn, ms, false),
    clearTimeout: cancel,
    setInterval: (fn, ms) => schedule(fn, ms, true),
    clearInterval: cancel,
    requestAnimationFrame: (fn) => schedule(() => fn(clock), 16, false),
    cancelAnimationFrame: cancel,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    performance: { now: () => clock },
    devicePixelRatio: 1,
    addEventListener: noop,
    removeEventListener: noop,
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    createSim: (opts) => {
      init = opts;
      return {
        checkpoint: (c) => events.push(`checkpoint:${c}`),
        event: (name) => events.push(name),
        resize: noop,
        isInitialized: () => initialized,
      };
    },
  };
  g.window = g;
  const context = vm.createContext(g);
  const file = path.join(PACKAGES, id, "main.js");
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  initialized = true;
  init?.onInit?.({ theme: "light", props, reducedMotion: false });
  await advance(400); // past the sims' 300 ms fallback render

  const find = (sel) => {
    const el = doc.querySelector(sel);
    assert.ok(el, `${id}: no element matches ${sel}`);
    return el;
  };
  /** Focus the control, then press it the way its key does. */
  async function press(sel, value) {
    const el = find(sel);
    el.focus();
    assert.equal(doc.activeElement, el, `${id}: ${sel} can't take focus`);
    const type = el.getAttribute("type");
    if (el.localName === "select" || type === "range") {
      el.value = value;
      el.dispatch("input");
      el.dispatch("change");
    } else if (type === "checkbox") {
      el.checked = !el.checked;
      el.dispatch("change");
    } else el.dispatch("click");
    await flush();
    return el;
  }
  return { doc, find, press, advance, events };
}

const describe = (el) => el === null ? "nothing" : el.localName === "body" ? "the page body" : `<${el.localName}${[...el.attrs].map(([k, v]) => ` ${k}="${v}"`).join("")}>`;

export { El, matches, makeDocument, loadSim, describe };
