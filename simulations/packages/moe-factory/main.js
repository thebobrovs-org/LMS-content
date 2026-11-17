// `createSim` is provided as a global by sim-sdk.js (loaded as a classic script
// before this one) so the bundle works in the opaque-origin sandbox.
const app = document.getElementById("app");

let N = 8; // number of experts
let mode = "top2"; // "top1" | "top2" | "dense"
let routed = 0; // tokens routed so far
let active = []; // expert indices active for the last token
let scores = []; // gating scores for the last token
let activeSum = 0; // running sum of active-expert counts (for average compute)
let observed = false;

const MODES = [
  { id: "top1", label: "Top-1", k: 1 },
  { id: "top2", label: "Top-2", k: 2 },
  { id: "dense", label: "Dense", k: null },
];

function kFor(m) {
  const found = MODES.find((x) => x.id === m);
  return found.k == null ? N : found.k;
}

// Deterministic gating score in [0,1) for (token, expert) — no randomness needed.
function gating(token, expert) {
  let h = (2166136261 ^ token) >>> 0;
  h = Math.imul(h ^ ((expert + 1) * 2654435761), 16777619) >>> 0;
  return (h % 1000) / 1000;
}

function reset() {
  routed = 0;
  active = [];
  scores = [];
  activeSum = 0;
  observed = false;
}

const pct = (k) => Math.round((k / N) * 100);

function routeToken() {
  const token = routed;
  scores = Array.from({ length: N }, (_, e) => gating(token, e));
  const k = kFor(mode);
  active = scores
    .map((s, i) => [s, i])
    .sort((a, b) => b[0] - a[0])
    .slice(0, k)
    .map(([, i]) => i);
  routed += 1;
  activeSum += active.length;

  if (mode !== "dense" && !observed) {
    observed = true;
    sim.checkpoint("observe-sparsity");
  }
  sim.event("route", { token, mode, active: active.length, pct: pct(active.length) });
  render();
}

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

/**
 * The focused control, as a selector for its replacement, so that it takes focus again after a render writes the
 * controls anew (LMS-content#135, as tpu-vm-anatomy does, #130); null when focus is elsewhere.
 */
function focusedControl() {
  const el = document.activeElement;
  if (!el || !app.contains(el)) return null;
  for (const attr of ["data-mode"]) {
    const value = el.getAttribute(attr);
    if (value !== null) return `[${attr}="${value}"]`;
  }
  return el.id ? `#${el.id}` : null;
}
/** Focus the control again after a render. */
function restoreFocus(sel) {
  const target = sel && app.querySelector(sel);
  if (target) target.focus();
}

function render() {
  const focused = focusedControl();
  const k = kFor(mode);
  const activeSet = new Set(active);
  const experts = Array.from({ length: N }, (_, i) => {
    const on = activeSet.has(i);
    const score = scores.length ? scores[i].toFixed(2) : "";
    return `<div class="expert ${on ? "on" : routed ? "off" : ""}">
        <span class="ename">E${i + 1}</span>
        <span class="score">${score}</span>
      </div>`;
  }).join("");

  const avg = routed ? Math.round((activeSum / routed / N) * 100) : pct(k);

  app.innerHTML = `
    <div class="controls">
      <div class="modes" role="group" aria-label="Routing mode">
        ${MODES.map(
          (m) =>
            `<button data-mode="${m.id}" class="${m.id === mode ? "active" : ""}" aria-pressed="${m.id === mode}">${m.label}</button>`,
        ).join("")}
      </div>
      <button id="route" class="primary">Route a token &rarr;</button>
      <button id="reset" class="secondary">Reset</button>
    </div>

    <div class="readout" role="status">
      ${
        routed
          ? `Token #${routed} routed to <strong>${active.length}</strong> of ${N} experts &mdash;
             <span class="good">${pct(active.length)}% compute</span>.
             Dense would run all ${N} (100%).`
          : `Pick a routing mode and route a token. The gating network scores all ${N} experts; only the top-k run.`
      }
    </div>

    <div class="experts">${experts}</div>

    <div class="stats">
      <span>Mode: <strong>${MODES.find((m) => m.id === mode).label}</strong> (k=${mode === "dense" ? N : k})</span>
      <span>Tokens routed: <strong>${routed}</strong></span>
      <span>Avg compute: <strong>${avg}%</strong></span>
    </div>
    <div class="legend">Each token activates only its top-k experts &mdash; sparse activation. Fewer active experts means less compute and latency, at some cost to capacity.</div>`;

  app.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.getAttribute("data-mode");
      render();
    }),
  );
  app.querySelector("#route").addEventListener("click", routeToken);
  app.querySelector("#reset").addEventListener("click", () => {
    reset();
    render();
  });
  restoreFocus(focused);
  reportSize();
}

const sim = createSim({
  onInit({ props, theme }) {
    const n = Number(props?.experts);
    N = Number.isFinite(n) && n >= 2 && n <= 16 ? Math.floor(n) : 8;
    applyTheme(theme);
    reset();
    render();
  },
});

// Fallback when opened directly (no host init).
setTimeout(() => {
  if (!sim.isInitialized() && routed === 0 && app.innerHTML === "") {
    reset();
    render();
  }
}, 300);
