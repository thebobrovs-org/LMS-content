// createSim is a global from sim-sdk.js (classic script). A [batch, features] tensor on a 2x4
// mesh (data=2 hosts, model=4 chips/host). Pick a PartitionSpec to see shard ownership, then
// run a step to watch the physical routing: a ONE-TIME host rendezvous over the DCN at startup,
// then the per-step collective over the ICI (data-parallel = all-reduce across the host boundary;
// model-parallel = all-gather dense within each host). Deterministic, theme + reduced-motion
// aware, no CDNs.

let REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

const TENSOR_MB = 1.0;            // [512, 1024] bf16 ~ 1.0 MB
const DATA = 2, MODEL = 4;        // 2 hosts, 4 chips each
const BLOCK_MB = TENSOR_MB / (DATA * MODEL);

const SPECS = {
  data: {
    perChipMB: BLOCK_MB * MODEL, collective: "all-reduce", net: "ici", bytes: 2 * TENSOR_MB, pattern: "pairs",
    iciNote: "<b>all-reduce over the data axis</b> — 4 cross-host pairs reconcile gradients. On one slice this rides the ICI; across slices (Multislice) it would fall to the DCN.",
  },
  model: {
    perChipMB: BLOCK_MB * DATA, collective: "all-gather", net: "ici", bytes: 0.75 * TENSOR_MB, pattern: "dense",
    iciNote: "<b>all-gather over the model axis</b> — dense traffic among each host's 4 chips, never leaving the host. Rides the ICI.",
  },
  replicated: {
    perChipMB: TENSOR_MB, collective: "none", net: "none", bytes: 0, pattern: "none",
    iciNote: "No collective — every chip already holds the whole tensor.",
  },
};

let currentSpec = "data";
let isAnimating = false, started = false, observed = false;

const $ = (id) => document.getElementById(id);
const btnRun = $("btn-run"), btnReset = $("btn-reset"), stage = $("stage"), note = $("status-note");

const delay = (ms) => new Promise((r) => setTimeout(r, REDUCE ? Math.min(ms, 350) : ms));
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 16)); }
function fireObserved() { if (!observed) { observed = true; sim.checkpoint("observe-spmd"); } }
function setPhase(p) { stage.className = "stage" + (p ? " phase-" + p : ""); }
function setNote(p, html) { note.className = "status-note" + (p ? " phase-" + p : ""); note.innerHTML = html; }

function owns(r, c, br, bc) {
  if (currentSpec === "data") return br === r;     // owns its batch band (all feature cols)
  if (currentSpec === "model") return bc === c;    // owns its feature band (all batch rows)
  return true;                                     // replicated: owns everything
}

function buildChips() {
  const ownClass = currentSpec === "data" ? "own-data" : currentSpec === "model" ? "own-model" : "own-rep";
  for (let host = 0; host < DATA; host++) {
    let html = "";
    for (let chip = 0; chip < MODEL; chip++) {
      let blocks = "";
      for (let br = 0; br < DATA; br++)
        for (let bc = 0; bc < MODEL; bc++)
          blocks += `<div class="tblock${owns(host, chip, br, bc) ? " " + ownClass : ""}"></div>`;
      html += `<div class="chip" id="chip-${host}-${chip}"><div class="chip-id">d${host}·m${chip}</div><div class="tmap">${blocks}</div></div>`;
    }
    $(`host${host}-chips`).innerHTML = html;
  }
}

function iciLine(id1, id2) {
  const e1 = $(id1), e2 = $(id2), canvas = $("ici-canvas");
  if (!e1 || !e2) return;
  const s = stage.getBoundingClientRect(), a = e1.getBoundingClientRect(), b = e2.getBoundingClientRect();
  const x1 = a.left + a.width / 2 - s.left, y1 = a.top + a.height / 2 - s.top;
  const x2 = b.left + b.width / 2 - s.left, y2 = b.top + b.height / 2 - s.top;
  for (const cls of ["ici-line", "ici-traffic"]) {
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", x1); ln.setAttribute("y1", y1); ln.setAttribute("x2", x2); ln.setAttribute("y2", y2);
    ln.setAttribute("class", cls);
    canvas.appendChild(ln);
  }
}

function drawICI() {
  const canvas = $("ici-canvas");
  canvas.innerHTML = "";
  const p = SPECS[currentSpec].pattern;
  if (p === "pairs") {
    // data-parallel: all-reduce over the data axis -> chip(0,c) <-> chip(1,c), 4 cross-host pairs
    for (let c = 0; c < MODEL; c++) iciLine(`chip-0-${c}`, `chip-1-${c}`);
  } else if (p === "dense") {
    // model-parallel: all-gather over the model axis -> dense within each host's 4 chips
    for (let host = 0; host < DATA; host++)
      for (let i = 0; i < MODEL; i++)
        for (let j = i + 1; j < MODEL; j++) iciLine(`chip-${host}-${i}`, `chip-${host}-${j}`);
  }
}

function updateDashboard() {
  const s = SPECS[currentSpec];
  const coll = s.collective === "none"
    ? `<span class="pill none">none</span>`
    : `${s.collective} <span class="pill ${s.net}">${s.net.toUpperCase()}</span>`;
  $("dashboard").innerHTML = `
    <div class="d-stat"><div class="d-k">Memory / chip</div><div class="d-v">${s.perChipMB.toFixed(2)} <small>MB</small></div></div>
    <div class="d-stat"><div class="d-k">Compiler inserts</div><div class="d-v" style="font-size:14px">${coll}</div></div>
    <div class="d-stat"><div class="d-k">Bytes on the wire</div><div class="d-v">${s.bytes.toFixed(2)} <small>MB</small></div></div>`;
}

function idleNote() {
  return `Showing <code>${currentSpec === "data" ? "P('data', None)" : currentSpec === "model" ? "P(None, 'model')" : "P()"}</code> shards. Press <b>Run a training step</b> to watch the routing.`;
}

function setSpec(spec, user) {
  if (isAnimating) return;
  currentSpec = spec;
  document.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("on", b.dataset.spec === spec));
  setPhase("");
  buildChips();
  updateDashboard();
  setNote("", idleNote());
  if (user) fireObserved();
  requestAnimationFrame(() => { drawICI(); reportSize(); });
}

async function runStep() {
  if (isAnimating) return;
  isAnimating = true; setRunBusy(true); btnReset.disabled = true;
  fireObserved();
  const s = SPECS[currentSpec];

  if (!started) {
    setPhase("dcn");
    setNote("dcn", "<b>Startup (once):</b> the hosts rendezvous over the <b>DCN</b> via the coordinator. A barrier timeout here = a host can't reach the coordinator (MTU / firewall) — not a chip fault.");
    await delay(2400);
    started = true;
  }

  setPhase("compute");
  setNote("compute", "<b>Local compute:</b> each chip runs the step on its shard — no network yet.");
  await delay(1400);

  if (s.net !== "none") {
    setPhase("ici");
    setNote("ici", "<b>Collective:</b> " + s.iciNote);
    await delay(3000);
  } else {
    setPhase("");
    setNote("", "<b>No collective:</b> every chip already holds the whole tensor — nothing crosses the wire.");
    await delay(900);
  }

  setPhase("");
  setNote("", "<b>Step complete.</b> The rendezvous was a one-time startup; every step after stays on the <b>ICI</b> (the DCN sits idle). Run again, or Reset to cold-start.");
  isAnimating = false; setRunBusy(false); btnReset.disabled = false;
}

// While a step plays, Run is marked aria-disabled rather than disabled: a disabled button loses focus, so a keyboard
// user who pressed Run would be dropped to the page (LMS-content#135). runStep() ignores presses meanwhile.
function setRunBusy(busy) {
  if (busy) btnRun.setAttribute("aria-disabled", "true");
  else btnRun.removeAttribute("aria-disabled");
}

function reset() {
  if (isAnimating) return;
  started = false;
  setPhase("");
  setNote("", "Cold. The next run does the one-time <b>DCN rendezvous</b> first, then the per-step <b>ICI</b> collective.");
  const fromReset = document.activeElement === btnReset;
  btnReset.disabled = true; // nothing to reset until the next run
  if (fromReset) btnRun.focus();
}

document.querySelectorAll(".seg-btn").forEach((b) => b.addEventListener("click", () => setSpec(b.dataset.spec, true)));
btnRun.addEventListener("click", runStep);
btnReset.addEventListener("click", reset);
window.addEventListener("resize", () => { if (!isAnimating) drawICI(); reportSize(); });

const sim = createSim({
  onInit({ theme, reducedMotion }) { REDUCE = REDUCE || reducedMotion; applyTheme(theme); setSpec("data", false); },
});
setTimeout(() => { if (!sim.isInitialized()) setSpec("data", false); }, 300);
