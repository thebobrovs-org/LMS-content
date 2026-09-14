// `createSim` is provided as a global by sim-sdk.js (loaded as a classic script
// before this one) so the bundle works in the opaque-origin sandbox.
const app = document.getElementById("app");

const RING = 65536; // hash space 0..RING-1
// Node colours, one palette per theme: each reads at 4.5:1 as the 13px labels on that theme's page
// (checked by simulations/tests/palette-contrast.test.mjs, LMS-content#99).
const PALETTE_LIGHT = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#db2777", "#15803d", "#0e7490", "#854d0e"];
const PALETTE_DARK = ["#60a5fa", "#2dd4bf", "#fbbf24", "#a78bfa", "#f472b6", "#4ade80", "#22d3ee", "#facc15"];
function palette() {
  const t = document.documentElement.dataset.theme;
  const dark = t === "dark" || (t !== "light" && typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches);
  return dark ? PALETTE_DARK : PALETTE_LIGHT;
}

let keyCount = 24;
let replicas = 1;
let nodes = ["A", "B", "C"];
let keys = []; // { name, h }
let owners = {}; // key name -> node (current ring owners)
let moved = new Set(); // key names moved by the last change
let observed = false;
let readout = null;

// FNV-1a 32-bit → 0..RING-1. Deterministic, dependency-free.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % RING;
}

function nodeColor(node) {
  const i = nodes.indexOf(node);
  return palette()[(i < 0 ? 0 : i) % palette().length];
}

// Virtual nodes for a node list: `replicas` positions per node, sorted by hash.
function vnodesFor(list) {
  const v = [];
  for (const n of list)
    for (let i = 0; i < replicas; i++) v.push({ h: hash(`${n}#${i}`), node: n });
  return v.sort((a, b) => a.h - b.h);
}

// Owner = first virtual node clockwise from the key's hash (wraps around).
function ringOwnerFor(kh, vlist) {
  if (vlist.length === 0) return null;
  for (const v of vlist) if (v.h >= kh) return v.node;
  return vlist[0].node;
}

function ringOwners(list) {
  const vlist = vnodesFor(list);
  const m = {};
  for (const k of keys) m[k.name] = ringOwnerFor(k.h, vlist);
  return m;
}

function modNOwners(list) {
  const m = {};
  for (const k of keys) m[k.name] = list.length ? list[k.h % list.length] : null;
  return m;
}

function countMoved(before, after) {
  return keys.reduce((n, k) => n + (before[k.name] !== after[k.name] ? 1 : 0), 0);
}

// Per-node key counts + imbalance (max ÷ average). 1.0 = perfectly even.
function loadSummary() {
  if (nodes.length === 0) return "";
  const counts = Object.fromEntries(nodes.map((n) => [n, 0]));
  for (const k of keys) if (owners[k.name] != null) counts[owners[k.name]] += 1;
  const avg = keys.length / nodes.length;
  const max = Math.max(...nodes.map((n) => counts[n]));
  const imbalance = avg > 0 ? (max / avg).toFixed(2) : "1.00";
  const per = nodes.map((n) => `${n} ${counts[n]}`).join(" · ");
  return `Per-node load: ${per} — imbalance ${imbalance}× (1.0 = even)`;
}

function regenKeys() {
  keys = [];
  for (let i = 0; i < keyCount; i++) keys.push({ name: `k${i}`, h: hash(`key-${i}`) });
}

function reset() {
  nodes = ["A", "B", "C"];
  regenKeys();
  owners = ringOwners(nodes);
  moved = new Set();
  readout = null;
}

// Apply a node-set change and measure the remap fraction (ring vs mod-N).
function applyChange(nextNodes, label) {
  const before = ringOwners(nodes);
  const after = ringOwners(nextNodes);
  const beforeMod = modNOwners(nodes);
  const afterMod = modNOwners(nextNodes);

  const ringMoved = countMoved(before, after);
  const modMoved = countMoved(beforeMod, afterMod);

  moved = new Set(keys.filter((k) => before[k.name] !== after[k.name]).map((k) => k.name));
  nodes = nextNodes;
  owners = after;

  const pct = (x) => Math.round((x / keys.length) * 100);
  readout = {
    label,
    n: nodes.length,
    ring: `${ringMoved}/${keys.length} keys (${pct(ringMoved)}%)`,
    mod: `${modMoved}/${keys.length} keys (${pct(modMoved)}%)`,
  };

  if (!observed) {
    observed = true;
    sim.checkpoint("observe-remap");
  }
  sim.event("rescale", { label, nodes: nodes.length, ringMoved, modMoved });
}

function addNode() {
  // Next unused letter A, B, C, …
  let code = 65;
  while (nodes.includes(String.fromCharCode(code))) code++;
  const name = String.fromCharCode(code);
  applyChange([...nodes, name], `Added node ${name}`);
  render();
}

function removeNode() {
  if (nodes.length <= 1) return;
  const name = nodes[nodes.length - 1];
  applyChange(nodes.slice(0, -1), `Removed node ${name}`);
  render();
}

function setReplicas(r) {
  replicas = Math.max(1, Math.min(8, r | 0));
  owners = ringOwners(nodes);
  moved = new Set();
  readout = { label: `Virtual nodes per node: ${replicas}`, n: nodes.length, ring: "—", mod: "—" };
  render();
}

// ---- rendering -------------------------------------------------------------
const C = 170;
const R = 120;
function pt(h, radius) {
  const a = (h / RING) * 2 * Math.PI;
  return [C + radius * Math.sin(a), C - radius * Math.cos(a)];
}

function svg() {
  const vlist = vnodesFor(nodes);
  const vmarks = vlist
    .map((v) => {
      const [x, y] = pt(v.h, R);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${nodeColor(v.node)}" stroke="var(--bg)" stroke-width="2"><title>${v.node}</title></circle>`;
    })
    .join("");
  // node labels: one per node, at its first replica position, pushed outside
  const labels = nodes
    .map((n) => {
      const [x, y] = pt(hash(`${n}#0`), R + 20);
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${nodeColor(n)}" font-size="13" font-weight="700" text-anchor="middle" dominant-baseline="middle">${n}</text>`;
    })
    .join("");
  const dots = keys
    .map((k) => {
      const [x, y] = pt(k.h, R - 26);
      const c = owners[k.name] ? nodeColor(owners[k.name]) : "var(--muted)";
      const ring = moved.has(k.name) ? `stroke="var(--fg)" stroke-width="2"` : "";
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${c}" ${ring}><title>${k.name} → ${owners[k.name]}</title></circle>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${C * 2} ${C * 2}" width="100%" role="img" aria-label="Hash ring with ${nodes.length} nodes and ${keys.length} keys">
    <circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="var(--border)" stroke-width="10" />
    ${dots}${vmarks}${labels}
  </svg>`;
}

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

// The controls are built and wired once (mount), never rebuilt: rebuilding them on every
// input event took keyboard focus off the slider after one step and cut drags short.
// render() refreshes only the outputs and the slider's label (#59).
let mounted = false;
function mount() {
  app.innerHTML = `
    <div class="controls">
      <button id="add">+ Add node</button>
      <button id="remove" class="secondary">− Remove node</button>
      <button id="reset" class="secondary">Reset</button>
      <label class="rep">vnodes/node
        <input id="rep" type="range" min="1" max="8" value="${replicas}" aria-label="Virtual nodes per node" />
        <span id="rep-val">${replicas}</span>
      </label>
    </div>
    <div class="readout" id="readout" role="status"></div>
    <div class="loads" id="loads"></div>
    <div class="ring" id="ring"></div>
    <div class="legend">Outer dots are nodes (with their virtual copies); inner dots are keys, colored by the node that owns them. Outlined keys moved on the last change.</div>`;

  app.querySelector("#add").addEventListener("click", addNode);
  app.querySelector("#remove").addEventListener("click", removeNode);
  app.querySelector("#reset").addEventListener("click", () => {
    reset();
    render();
  });
  app.querySelector("#rep").addEventListener("input", (e) => setReplicas(Number(e.target.value)));
  mounted = true;
}

function render() {
  if (!mounted) mount();
  const r = readout;
  const rep = app.querySelector("#rep");
  if (Number(rep.value) !== replicas) rep.value = String(replicas);
  app.querySelector("#rep-val").textContent = String(replicas);
  app.querySelector("#readout").innerHTML = r
    ? `<strong>${r.label}</strong> — now ${r.n} node(s).
       <span class="good">Ring remapped ${r.ring}.</span>
       <span class="bad">mod-N would remap ${r.mod}.</span>`
    : `Ring with ${nodes.length} nodes, ${keys.length} keys. Add or remove a node and watch how few keys move.`;
  app.querySelector("#loads").innerHTML = loadSummary();
  app.querySelector("#ring").innerHTML = svg();
  reportSize();
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

const sim = createSim({
  onInit({ props, theme }) {
    const k = Number(props?.keys);
    const r = Number(props?.replicas);
    keyCount = Number.isFinite(k) && k > 0 ? Math.floor(k) : 24;
    replicas = Number.isFinite(r) && r > 0 ? Math.min(8, Math.floor(r)) : 1;
    applyTheme(theme);
    reset();
    render();
  },
});

// Fallback when opened directly (no host init).
setTimeout(() => {
  if (!sim.isInitialized() && keys.length === 0) {
    reset();
    render();
  }
}, 300);
