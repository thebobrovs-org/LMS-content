// createSim is a global from sim-sdk.js (classic script). The communication cost of distributed
// training. Each step every device's gradient (a payload the size of the model) is all-reduced over the
// interconnect; sync time = bytes / bandwidth. With a fixed global batch (strong scaling), adding devices
// shrinks per-device compute but the all-reduce stays ~flat (ring property) — so past some scale the run
// goes communication-bound and more devices stop helping. Vendor-neutral, simplified ring-all-reduce
// model (applies to any accelerator fabric — NVLink, InfiniBand, and others). Deterministic,
// theme + reduced-motion aware, no CDNs.

const $ = (id) => document.getElementById(id);
const DEV = [2, 4, 8, 16, 32, 64, 128, 256];
const BW = { 50: "cross-node network ~50 GB/s", 300: "accelerator link ~300 GB/s", 600: "fast interconnect ~600 GB/s", 900: "top-tier link ~900 GB/s" };

let pB = 7;          // model size, billions of params
let nIdx = 3;        // DEV index -> 16 devices
let bw = 600;        // GB/s
let compute1 = 1600; // ms, compute for one full step on 1 device
let overlap = false;
let observed = false, interacted = false;

function applyTheme(t) { if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 16)); }
const fmtMs = (m) => m >= 100 ? Math.round(m) : m >= 10 ? m.toFixed(0) : m.toFixed(1);

function calc(n) {
  const payloadGB = pB * 2;                          // bf16 grads = 2 bytes/param
  const allreduceGB = 2 * (n - 1) / n * payloadGB;   // ring all-reduce volume per device
  const syncMs = allreduceGB / bw * 1000;
  const computeMs = compute1 / n;                    // strong scaling: fixed global batch
  const stepMs = overlap ? Math.max(computeMs, syncMs) : computeMs + syncMs;
  return { payloadGB, allreduceGB, syncMs, computeMs, stepMs, speedup: compute1 / stepMs };
}

function chartSVG() {
  const W = 560, H = 230, ml = 38, mb = 26, mt = 8, mr = 10;
  const w = W - ml - mr, h = H - mb - mt;
  const xs = DEV.map((d) => Math.log2(d));            // 1..8
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const ymax = Math.log2(DEV[DEV.length - 1]);        // 8 (ideal at 256)
  const px = (lx) => ml + (lx - x0) / (x1 - x0) * w;
  const py = (ly) => mt + h - Math.min(ly, ymax) / ymax * h;

  let g = `<line class="cl-axis" x1="${ml}" y1="${mt}" x2="${ml}" y2="${mt + h}"/><line class="cl-axis" x1="${ml}" y1="${mt + h}" x2="${ml + w}" y2="${mt + h}"/>`;
  // x ticks (device counts)
  DEV.forEach((d) => { const x = px(Math.log2(d)); g += `<text class="cl-t" x="${x.toFixed(0)}" y="${H - 8}" text-anchor="middle">${d}</text>`; });
  g += `<text class="cl-t" x="${ml + w}" y="${H - 8}" text-anchor="end" dy="14">devices</text>`;
  // y ticks (speedup powers of 2)
  [1, 4, 16, 64, 256].forEach((s) => { const y = py(Math.log2(s)); g += `<text class="cl-t" x="${ml - 6}" y="${y.toFixed(0)}" text-anchor="end" dy="3">${s}×</text>`; });

  // ideal (linear) speedup = n  -> log2 line y=x : straight diagonal
  g += `<polyline class="cl-ideal" points="${DEV.map((d) => `${px(Math.log2(d)).toFixed(1)},${py(Math.log2(d)).toFixed(1)}`).join(" ")}"/>`;
  // actual speedup curve
  const actual = DEV.map((d) => { const sp = calc(d).speedup; return `${px(Math.log2(d)).toFixed(1)},${py(Math.log2(Math.max(1, sp))).toFixed(1)}`; });
  g += `<polyline class="cl-actual" points="${actual.join(" ")}"/>`;
  // current N marker
  const cur = calc(DEV[nIdx]);
  g += `<circle class="cl-dot" cx="${px(Math.log2(DEV[nIdx])).toFixed(1)}" cy="${py(Math.log2(Math.max(1, cur.speedup))).toFixed(1)}" r="4.5"/>`;
  g += `<text class="cl-t" x="${ml + 4}" y="${mt + 10}">— — ideal (linear)   —— actual</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="speedup versus device count: actual curve flattens below the ideal linear line as communication dominates">${g}</svg>`;
}

function render() {
  const n = DEV[nIdx];
  const r = calc(n);
  const commBound = r.syncMs > r.computeMs;
  const eff = r.stepMs > 0 ? (r.computeMs / r.stepMs) * (overlap ? 1 : 1) : 0; // fraction of step doing compute
  const scalingEff = (compute1 / n) / r.stepMs * 100;                          // vs perfect linear scaling

  $("controls").innerHTML =
    `<div class="sl"><label for="c-p">Model size <b>${pB}B params</b></label><input type="range" id="c-p" min="1" max="70" step="1" value="${pB}"></div>` +
    `<div class="sl"><label for="c-n">Devices (ring) <b>${n}</b></label><input type="range" id="c-n" min="0" max="${DEV.length - 1}" step="1" value="${nIdx}"></div>` +
    `<div class="sl"><label for="c-b">Interconnect bandwidth <b>${bw} GB/s</b></label><select id="c-b">${Object.keys(BW).map((k) => `<option value="${k}" ${+k === bw ? "selected" : ""}>${BW[k]}</option>`).join("")}</select></div>` +
    `<div class="sl"><label for="c-c">Compute / step (1 device) <b>${compute1} ms</b></label><input type="range" id="c-c" min="100" max="4000" step="100" value="${compute1}"></div>` +
    `<div class="sl toggle"><label for="c-o" style="display:block">Overlap comm<br><span style="font-weight:400;color:var(--muted)">hide sync behind compute</span></label><span class="sw"><input type="checkbox" id="c-o" ${overlap ? "checked" : ""}><span class="tr"></span><span class="kn"></span></span></div>`;

  $("cards").innerHTML =
    `<div class="card"><div class="k">Gradient payload</div><div class="v">${r.payloadGB.toFixed(0)} GB</div></div>` +
    `<div class="card"><div class="k">Compute / device</div><div class="v comp">${fmtMs(r.computeMs)} ms</div></div>` +
    `<div class="card"><div class="k">All-reduce sync</div><div class="v comm">${fmtMs(r.syncMs)} ms</div></div>` +
    `<div class="card"><div class="k">Step time</div><div class="v">${fmtMs(r.stepMs)} ms</div></div>`;

  const ref = Math.max(r.computeMs, r.syncMs) * 1.12 || 1;
  $("bars").innerHTML =
    `<div class="bar compute"><div class="lab"><span class="nm">Compute per device <b>(${n} devices share the batch)</b></span><span class="ms">${fmtMs(r.computeMs)} ms</span></div><div class="track"><div class="fill" style="width:${(r.computeMs / ref * 100).toFixed(1)}%"></div></div></div>` +
    `<div class="bar comm"><div class="lab"><span class="nm">All-reduce the gradient <b>(${r.allreduceGB.toFixed(0)} GB across the interconnect)</b></span><span class="ms">${fmtMs(r.syncMs)} ms</span></div><div class="track"><div class="fill" style="width:${(r.syncMs / ref * 100).toFixed(1)}%"></div></div></div>`;

  const note = $("note");
  note.className = "note" + (commBound ? " bound" : "");
  note.innerHTML = commBound
    ? `<span class="pill bad">Communication-bound.</span> The all-reduce (<b>${fmtMs(r.syncMs)} ms</b>) now outweighs per-device compute (<b>${fmtMs(r.computeMs)} ms</b>): scaling efficiency is just <b>${scalingEff.toFixed(0)}%</b> of ideal. Adding devices barely helps — the gradient sync is the wall. Levers: <b>${overlap ? "you're already overlapping; you now need a faster interconnect or bigger steps" : "turn on Overlap, or use a faster interconnect / bigger steps"}</b> — not more devices.`
    : `<span class="pill ok">Compute-bound.</span> Per-device compute (<b>${fmtMs(r.computeMs)} ms</b>) still dominates the sync (<b>${fmtMs(r.syncMs)} ms</b>), so devices are well used — scaling efficiency <b>${scalingEff.toFixed(0)}%</b>. Push the device count up (or the model size) and watch the red sync bar catch the green compute bar.`;

  $("chart").innerHTML = chartSVG();

  if (commBound && interacted && !observed) { observed = true; sim.checkpoint("observe-comm-bound"); }

  $("c-p").addEventListener("input", (e) => { pB = +e.target.value; interacted = true; sim.event("set", { pB }); render(); });
  $("c-n").addEventListener("input", (e) => { nIdx = +e.target.value; interacted = true; sim.event("set", { n: DEV[nIdx] }); render(); });
  $("c-b").addEventListener("change", (e) => { bw = +e.target.value; interacted = true; render(); });
  $("c-c").addEventListener("input", (e) => { compute1 = +e.target.value; interacted = true; render(); });
  $("c-o").addEventListener("change", (e) => { overlap = e.target.checked; interacted = true; render(); });
  reportSize();
}

const sim = createSim({ onInit({ theme }) { applyTheme(theme); render(); } });
new ResizeObserver(() => reportSize()).observe(document.body);
setTimeout(() => { if (!sim.isInitialized()) render(); }, 300);
