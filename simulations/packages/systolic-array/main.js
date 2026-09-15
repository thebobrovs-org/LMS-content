// `createSim` is a global from sim-sdk.js (classic script). A faithful port of
// the "Systolic Array Explained" sim: an animated Fetching-vs-Pumping concept
// view and a step-driven 3x3 array simulator with metrics + an event log.
// Theme-aware, SDK-wired, no CDNs. Deterministic.
const app = document.getElementById("app");
let mode = "why";

const heartSVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 21s-6.7-4.4-9.3-8.2C.9 10 1.6 6.4 4.6 5.2 6.8 4.3 9 5.2 12 8c3-2.8 5.2-3.7 7.4-2.8 3 1.2 3.7 4.8 1.9 7.6C18.7 16.6 12 21 12 21z"/></svg>`;
const chipSVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>`;

/* ----------------------------- WHY (static, animated) ----------------------------- */
function renderWhy() {
  return `
  <div class="cards">
    <div class="card">
      <h3>${chipSVG} Traditional CPU (von Neumann)</h3>
      <p class="lead">The core stops, sends a request (<span class="tag-grey">grey</span>), fetches data
        (<span class="tag-blue">blue</span>), computes, and writes back (<span class="tag-green">green</span>)
        to memory. <span class="bad-t">High-latency bottleneck.</span></p>
      <div class="diagram cpu-dia">
        <span class="chip-label">Main Memory (RAM)</span>
        <div class="bus-v"></div>
        <span class="cpu-packet run"></span>
        <div class="alu">${chipSVG}<span>ALU Core</span></div>
      </div>
      <div class="statbox">
        <div class="statbox-h">To compute a 3×3 matrix (27 ops):</div>
        <div class="statrow"><span>Clock cycles</span><span class="pill bad mono">~27+ cycles</span></div>
        <div class="statrow"><span>RAM accesses</span><span class="pill bad mono">~54 reads</span></div>
        <div class="statnote">The CPU runs sequentially — it re-fetches weights and activations for every single calculation.</div>
      </div>
    </div>
    <div class="card">
      <h3><span class="heart beat">${heartSVG}</span> TPU systolic array</h3>
      <p class="lead">Data is pumped from memory <em>once</em>. A cell computes and instantly
        <strong>passes</strong> the value to the next — data is reused. <span class="good-t">Massive throughput.</span></p>
      <div class="diagram tpu-dia">
        <div class="tpu-line"></div>
        <span class="chip-label">Queue</span>
        <span class="pass p1">Pass →</span><span class="pass p2">Pass →</span>
        <span class="tpu-packet run"></span><span class="tpu-packet run d1"></span><span class="tpu-packet run d2"></span>
        <div class="tpu-cell f1">Cell 1<br><small>+ compute</small></div>
        <div class="tpu-cell f2">Cell 2<br><small>+ compute</small></div>
        <div class="tpu-cell f3">Cell 3<br><small>+ compute</small></div>
      </div>
      <div class="statbox good">
        <div class="statbox-h">To compute a 3×3 matrix (27 ops):</div>
        <div class="statrow"><span>Clock cycles</span><span class="pill good mono">exactly 7 cycles</span></div>
        <div class="statrow"><span>RAM accesses</span><span class="pill good mono">18 reads</span></div>
        <div class="statnote">Up to 7 of the 9 cells compute in the same beat, and each value is read from RAM once and reused down the line.</div>
      </div>
    </div>
  </div>
  <p class="lead" style="margin-top:14px">Same 27 multiply-accumulates either way. Switch to <strong>How: the array</strong> to drive it cell by cell.</p>`;
}

/* ----------------------------- HOW (simulator) ----------------------------- */
// Input vector k's element in row r reaches column c at heartbeat k + r + c + 1, so the
// last multiply-accumulate (k, r and c all SIZE − 1) happens at heartbeat 3·SIZE − 2 = 7.
const SIZE = 3, TOTAL = 3 * SIZE - 2;
const WEIGHTS = [[2, 1, 3], [1, 4, 1], [3, 1, 2]];
const INPUT = [
  [1, 2, 3, 0, 0, 0, 0, 0],
  [0, 4, 1, 2, 0, 0, 0, 0],
  [0, 0, 2, 3, 1, 0, 0, 0],
];
let cycle = 0, peGrid = [], observed = false, arrTimer = null;

/** One heartbeat: partial sums move down, activations move right, and every busy cell adds act × weight. */
function advance(grid, t) {
  const next = blank();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) next[r][c].psum = r === 0 ? 0 : grid[r - 1][c].psum;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) next[r][c].act = c === 0 ? INPUT[r][t] || 0 : grid[r][c - 1].act;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (next[r][c].act > 0) next[r][c].psum += next[r][c].act * WEIGHTS[r][c];
  return next;
}
const busyCells = (grid) => grid.flat().filter((cell) => cell.act > 0).length;
// Busy cells at each heartbeat, from a dry run of the same dataflow: 1, 3, 6, 7, 6, 3, 1.
// The narration reads these numbers, so it can't drift from what the array does.
const PROFILE = (() => {
  let grid = blank();
  const busy = [];
  for (let t = 0; t < TOTAL; t++) { grid = advance(grid, t); busy.push(busyCells(grid)); }
  return busy;
})();
const PEAK = PROFILE.indexOf(Math.max(...PROFILE)) + 1;

function blank() { return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ({ act: 0, psum: 0 }))); }
function resetArray() { if (arrTimer) { clearInterval(arrTimer); arrTimer = null; } cycle = 0; peGrid = blank(); observed = false; }

function buildHow() {
  let rows = "";
  for (let r = 0; r < SIZE; r++)
    rows += `<div class="mrow"><div class="queue" id="q-${r}"></div>${[0, 1, 2].map((c) => `<div class="pe" id="pe-${r}-${c}"><span class="w">W:${WEIGHTS[r][c]}</span><span class="math mono" id="math-${r}-${c}">0 × ${WEIGHTS[r][c]}</span><span class="psum mono" id="psum-${r}-${c}">Σ 0</span></div>`).join("")}</div>`;

  return `
  <div class="sim">
    <div class="cp">
      <div class="cp-head"><span>Control panel</span><span class="heart beat" title="heartbeat">${heartSVG}</span></div>
      <button id="step" class="btn-step">Pump data (step) <span>→</span></button>
      <div class="cp-row">
        <button id="play">▶ Auto-play</button>
        <button id="reset">↺ Reset</button>
      </div>
      <div class="mcards">
        <div class="mcard"><div class="mlabel">Cycle (time)</div><div class="mval mono" id="m-cycle">0</div></div>
        <div class="mcard"><div class="mlabel">Utilization</div><div class="mval blue mono" id="m-util">0%</div></div>
      </div>
      <div class="console">
        <div class="console-h">&gt;_ Engineer's event log</div>
        <div class="console-log mono" id="log" tabindex="0" role="region" aria-label="Engineer's event log (scrollable)"></div>
      </div>
    </div>
    <div class="grid-panel">
      <div class="legend">
        <span><i class="dot w"></i> Stationary weights</span>
        <span><i class="dot a"></i> Flowing activations</span>
        <span><i class="dot s"></i> Accumulated sums</span>
      </div>
      <div class="flow-top">↓ partial sums flow down · activations flow right →</div>
      <div class="matrix">${rows}</div>
    </div>
  </div>`;
}

function logMsg(text, cls) {
  const el = document.getElementById("log");
  if (!el) return;
  const e = document.createElement("div");
  e.className = `log-entry ${cls || ""}`;
  e.innerHTML = `<span class="sys">[sys]</span>${text}`;
  el.appendChild(e);
  el.scrollTop = el.scrollHeight;
}
function narrate(c) {
  const busy = `${PROFILE[c - 1]} of ${SIZE * SIZE} cells compute`;
  if (c === 1) return `Heartbeat 1 — the first activation enters cell (0,0); ${busy}.`;
  if (c < PEAK) return `Heartbeat ${c} — the diagonal wavefront spreads; ${busy}, each on a value already inside the array.`;
  if (c === PEAK) return `Heartbeat ${c} — peak utilization: ${busy} at once, with no re-fetch from memory.`;
  if (c < TOTAL) return `Heartbeat ${c} — the queues are empty and the wavefront drains; ${busy}.`;
  const macs = PROFILE.reduce((sum, n) => sum + n, 0);
  return `Heartbeat ${c} — the last multiply-accumulate: all ${macs} are done, and the results leave the bottom of the array.`;
}
function renderQueues() {
  for (let r = 0; r < SIZE; r++) {
    const q = document.getElementById(`q-${r}`);
    if (!q) continue;
    let html = "";
    for (let i = cycle; i < Math.min(cycle + 3, INPUT[r].length); i++) {
      const v = INPUT[r][i];
      html += `<span class="qi ${v > 0 ? "data" : "zero"}">${v}</span>`;
    }
    if (cycle < TOTAL) html += `<span class="qarrow">▸</span>`;
    q.innerHTML = html;
  }
}
function updateHow() {
  const cyc = document.getElementById("m-cycle");
  if (cyc) cyc.textContent = cycle;
  let active = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = peGrid[r][c];
      const pe = document.getElementById(`pe-${r}-${c}`);
      const math = document.getElementById(`math-${r}-${c}`);
      const psum = document.getElementById(`psum-${r}-${c}`);
      if (!pe) continue;
      if (cell.act > 0) {
        active++;
        pe.classList.add("on");
        math.innerHTML = `<b>${cell.act}</b> × <i>${WEIGHTS[r][c]}</i>`;
        psum.textContent = `Σ ${cell.psum}`;
      } else {
        pe.classList.remove("on");
        math.innerHTML = `0 × ${WEIGHTS[r][c]}`;
        psum.textContent = `Σ ${cell.psum}`;
      }
    }
  const util = document.getElementById("m-util");
  if (util) util.textContent = `${Math.round((active / (SIZE * SIZE)) * 100)}%`;
  const step = document.getElementById("step");
  if (step) step.disabled = cycle >= TOTAL;
  renderQueues();
  reportSize();
}
function step() {
  if (cycle >= TOTAL) return;
  peGrid = advance(peGrid, cycle);
  cycle += 1;
  updateHow();
  logMsg(narrate(cycle), cycle === PEAK || cycle >= TOTAL ? "peak" : "");
  if (cycle >= TOTAL && !observed) { observed = true; sim.checkpoint("observe-matmul"); }
  sim.event("cycle", { cycle });
}
function togglePlay() {
  const btn = document.getElementById("play");
  if (arrTimer) { clearInterval(arrTimer); arrTimer = null; if (btn) btn.textContent = "▶ Auto-play"; return; }
  if (cycle >= TOTAL) { resetArray(); updateHow(); document.getElementById("log").innerHTML = ""; logMsg("System reset. Weights reloaded; queues prepared.", "boot"); }
  if (btn) btn.textContent = "❚❚ Pause";
  arrTimer = setInterval(() => { step(); if (cycle >= TOTAL) { clearInterval(arrTimer); arrTimer = null; if (btn) btn.textContent = "▶ Auto-play"; } }, 1100);
}
function wireHow() {
  document.getElementById("step").addEventListener("click", step);
  document.getElementById("play").addEventListener("click", togglePlay);
  document.getElementById("reset").addEventListener("click", () => {
    resetArray();
    document.getElementById("log").innerHTML = "";
    logMsg("System boot — weights loaded into processing elements; input queues prepared.", "boot");
    updateHow();
  });
  logMsg("System boot — weights loaded into processing elements; input queues prepared.", "boot");
  updateHow();
}

/* ------------------------------- shell -------------------------------- */
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8)); }
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function switchMode(m) {
  if (m === mode) return;
  if (arrTimer) { clearInterval(arrTimer); arrTimer = null; }
  mode = m;
  render();
}

/** The two views, in tab order: the mode and its tab's label. */
const TABS = [["why", "Why: CPU vs TPU"], ["array", "How: the array"]];
let mounted = false;

/**
 * The tab list is built once, so the tab a keyboard user is on stays the same element and keeps
 * focus; only the panel is rewritten. The selected tab is the one in the Tab order, and the arrow
 * keys, Home and End move between the tabs and show each, as a tab list does (LMS-content#100, #98).
 */
function mount() {
  app.innerHTML = `
    <div class="tabs" role="tablist" aria-label="View">${TABS.map(([m, label]) => `<button type="button" id="tab-${m}" class="tab" role="tab" aria-controls="panel" aria-selected="false" tabindex="-1">${label}</button>`).join("")}</div>
    <div class="body" id="panel" role="tabpanel"></div>`;
  TABS.forEach(([m], at) => {
    const tab = app.querySelector(`#tab-${m}`);
    tab.addEventListener("click", () => switchMode(m));
    tab.addEventListener("keydown", (e) => {
      let to = -1;
      if (e.key === "ArrowRight") to = (at + 1) % TABS.length;
      else if (e.key === "ArrowLeft") to = (at + TABS.length - 1) % TABS.length;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = TABS.length - 1;
      if (to < 0) return;
      e.preventDefault();
      switchMode(TABS[to][0]);
      app.querySelector(`#tab-${TABS[to][0]}`).focus();
    });
  });
  mounted = true;
}

function render() {
  if (!mounted) mount();
  for (const [m] of TABS) {
    const tab = app.querySelector(`#tab-${m}`);
    tab.classList.toggle("active", m === mode);
    tab.setAttribute("aria-selected", String(m === mode));
    tab.setAttribute("tabindex", m === mode ? "0" : "-1");
  }
  const panel = app.querySelector("#panel");
  panel.setAttribute("aria-labelledby", `tab-${mode}`);
  // The Why view holds nothing focusable, so its panel is the next Tab stop after the tab; the How view's own controls are.
  panel.setAttribute("tabindex", mode === "why" ? "0" : "-1");
  panel.innerHTML = mode === "why" ? renderWhy() : buildHow();
  if (mode === "array") { resetArray(); wireHow(); }
  reportSize();
}

const sim = createSim({
  onInit({ theme }) { applyTheme(theme); render(); },
});
setTimeout(() => { if (!sim.isInitialized() && app.innerHTML === "") render(); }, 300);
