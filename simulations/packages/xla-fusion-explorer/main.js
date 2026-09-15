// createSim is a global from sim-sdk.js (classic script). Walk the compile pipeline —
// Python → jaxpr → StableHLO → XLA fused kernel — inspecting the REAL artifact at each
// stage (captured from JAX 0.4.30, lightly trimmed), then race the result: the unfused
// baseline round-trips every op through HBM (9 trips), the XLA-fused kernel keeps the
// intermediates in VMEM (3 trips). Same FLOPs, far fewer bytes → arithmetic intensity
// jumps past the v5p ridge and the layer flips from memory-bound to compute-bound.
// Deterministic, theme-aware, reduced-motion aware, no CDNs.

// Honor both the OS media query and the host's explicit reducedMotion flag (set in onInit).
let REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

// One illustrative layer: A[512×512] @ W[512×512] → +bias → GELU → ×scale, bf16.
const TENSOR_MB = 0.5; // a 512×512 bf16 tensor ≈ 0.5 MB
const FLOPS = 268; // matmul dominates ≈ 268 MFLOP (2·512³)
const RIDGE = 165; // v5p ridge, FLOP/byte
const UNFUSED_TRIPS = 9; // matmul reads A+W, writes Y (3); +bias/GELU/scale each read+write (6)
const FUSED_TRIPS = 3; // read A, read W, write final — intermediates stay in VMEM

let isRunning = false, jitDone = false, jitStep = 0, isAuto = false, isStepAnimating = false, observedRace = false;
let uTrips = 0, fTrips = 0;

const $ = (id) => document.getElementById(id);
const btnStep = $("btn-step"), btnAuto = $("btn-auto-jit"), btnRun = $("btn-run"), btnReset = $("btn-reset");
const note = $("dynamic-note"), inspectorPanel = $("inspector-panel"), inspectorContent = $("inspector-content");

const delay = (ms) => new Promise((r) => setTimeout(r, REDUCE ? 0 : ms));
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 16)); }

// --- Inspector content: faithful, lightly-trimmed real JAX output for this exact layer ---
const inspectorData = {
  python: {
    title: "1. Python function",
    code: `<span class="syn-kw">@jax.jit</span>
<span class="syn-kw">def</span> <span class="syn-fn">layer</span>(x, w, b, s):
    y = x <span class="syn-op">@</span> w            <span class="syn-cm"># MatMul</span>
    y = y <span class="syn-op">+</span> b            <span class="syn-cm"># + bias</span>
    y = jax.nn.<span class="syn-fn">gelu</span>(y)     <span class="syn-cm"># activation</span>
    <span class="syn-kw">return</span> y <span class="syn-op">*</span> s        <span class="syn-cm"># × scale</span>`,
    desc: "You write NumPy-like Python. <code>@jax.jit</code> tells JAX to <i>compile</i> this function instead of running it eagerly op-by-op.",
  },
  trace: {
    title: "2. JAX trace (jaxpr)",
    code: `<span class="syn-kw">{ lambda</span> ; a:<span class="syn-ty">bf16[512,512]</span> b:<span class="syn-ty">bf16[512,512]</span> …
  <span class="syn-kw">let</span> e = <span class="syn-fn">dot_general</span> a b      <span class="syn-cm"># MatMul</span>
      g = <span class="syn-fn">add</span> e b_bcast        <span class="syn-cm"># + bias</span>
      <span class="syn-cm"># gelu expands to a tanh-approx chain:</span>
      h = <span class="syn-fn">integer_pow</span>[y=3] g
      … <span class="syn-fn">mul</span> · <span class="syn-fn">add</span> · <span class="syn-fn">tanh</span> · <span class="syn-fn">mul</span> …
      o = <span class="syn-fn">mul</span> g n             <span class="syn-cm"># = gelu(g)</span>
      p = <span class="syn-fn">mul</span> o d             <span class="syn-cm"># × scale</span>
  <span class="syn-kw">in</span> (p,) }`,
    desc: "JAX runs your code once with <i>abstract</i> values to record a static graph (jaxpr). Shapes freeze to <code>bf16[512,512]</code>. Note <code>gelu</code> isn't one op — that single activation is really ~10 basic add/multiply/tanh ops (its math formula, expanded). You don't need the formula; the point is XLA fuses every one of them into the matmul.",
  },
  hlo: {
    title: "3. StableHLO",
    code: `<span class="syn-fn">%0 </span>= <span class="syn-op">stablehlo.dot_general</span> %x, %w   <span class="syn-cm">: bf16[512,512]</span>
<span class="syn-fn">%3 </span>= <span class="syn-op">stablehlo.add</span> %0, %bias
<span class="syn-fn">%4 </span>= <span class="syn-op">stablehlo.multiply</span> %3, %3      <span class="syn-cm"># g² ┐ gelu</span>
<span class="syn-fn">%11</span>= <span class="syn-op">stablehlo.tanh</span> %10            <span class="syn-cm"># …  │ tanh-approx</span>
<span class="syn-fn">%16</span>= <span class="syn-op">stablehlo.multiply</span> %3, %15     <span class="syn-cm"># =gelu ┘</span>
<span class="syn-fn">%18</span>= <span class="syn-op">stablehlo.multiply</span> %16, %scale <span class="syn-cm"># × scale</span>`,
    desc: "The jaxpr lowers to <b>StableHLO</b> — a portable, hardware-neutral IR (the same program runs on CPU, GPU, or TPU). The op set is all primitives: <code>dot_general</code>, <code>add</code>, <code>multiply</code>, <code>tanh</code> — no opaque <code>gelu</code> call.",
  },
  xla: {
    title: "4. XLA fused kernel",
    code: `<span class="syn-cm">// XLA targets the TPU and fuses the chain:</span>
<span class="syn-fn">%fused_computation</span> <span class="syn-op">{</span>
  %dot = <span class="syn-fn">dot_general</span>(%x, %w)    <span class="syn-cm">// MXU</span>
  %g   = <span class="syn-fn">add</span>(%dot, %bias)      <span class="syn-cm">// ┐ epilogue,</span>
  %a   = gelu_chain(%g)           <span class="syn-cm">// │ all in VMEM</span>
  ROOT = <span class="syn-fn">multiply</span>(%a, %scale)  <span class="syn-cm">// ┘</span>
<span class="syn-op">}</span>
<span class="syn-fn">%fusion</span> = <span class="syn-ty">bf16[512,512]</span> <span class="syn-kw">fusion</span>(…), kind=kLoop`,
    desc: "XLA sees that <code>add</code>, <code>gelu</code> and <code>scale</code> can ride in the matmul's epilogue. It emits a single fused kernel: intermediates stay in on-chip <b>VMEM</b>, so only the inputs and final output touch HBM. Same FLOPs, far fewer bytes.",
  },
};

function updateInspector(key, isXla) {
  const d = inspectorData[key];
  inspectorContent.innerHTML =
    `<div class="inspector-code" tabindex="0" role="region" aria-label="The code for this stage (scrollable)">${d.code}</div>` +
    `<div class="inspector-explain ${isXla ? "xla-h4" : ""}"><h4>${d.title}</h4><p>${d.desc}</p></div>`;
  reportSize();
}

// --- Advance the compile pipeline to stage n (1..4) ---
function applyStage(n) {
  if (n === 1) {
    note.innerHTML = "<i>Parsing your Python function…</i>";
    $("cn-py").classList.add("active"); updateInspector("python");
    btnStep.textContent = "Step: JAX trace";
  } else if (n === 2) {
    $("ca-1").classList.add("active"); $("cn-trace").classList.add("active"); updateInspector("trace");
    btnStep.textContent = "Step: StableHLO";
  } else if (n === 3) {
    note.innerHTML = "<i>Lowering to <b>StableHLO</b> — the portable, hardware-neutral IR…</i>";
    $("ca-2").classList.add("active"); $("cn-hlo").classList.add("active"); updateInspector("hlo");
    btnStep.textContent = "Step: XLA compile";
  } else if (n === 4) {
    note.innerHTML = "<i><b>XLA</b> compiles for TPU — fusing MatMul + bias + GELU + scale into one kernel…</i>";
    $("ca-3").classList.add("active"); $("cn-xla").classList.add("active"); updateInspector("xla", true);
    const fc = $("fused-col");
    fc.classList.remove("locked");
    if (!REDUCE) fc.classList.add("highlight-pulse");
    btnRun.disabled = false; jitDone = true; btnStep.disabled = true; btnAuto.disabled = true;
    btnStep.textContent = "Compiled ✓";
    note.innerHTML = "<b>Compiled.</b> XLA traced the graph and fused the ops. Press <b>Execute</b> to race the unfused baseline against the XLA-fused kernel.";
    sim.event("jit-completed", {});
  }
  jitStep = n;
}

async function stepJit() {
  if (jitDone || isAuto || isStepAnimating) return;
  isStepAnimating = true; btnReset.disabled = true;
  inspectorPanel.classList.add("visible");
  applyStage(jitStep + 1);
  isStepAnimating = false; btnReset.disabled = false;
}

async function autoJit() {
  if (jitDone || isAuto || isStepAnimating) return;
  isAuto = true; btnStep.disabled = true; btnAuto.disabled = true; btnReset.disabled = true;
  inspectorPanel.classList.add("visible");
  while (jitStep < 4) { applyStage(jitStep + 1); if (jitStep < 4) await delay(1500); }
  isAuto = false; btnReset.disabled = false;
}

function resetAll() {
  if (isRunning || isAuto || isStepAnimating) return;
  jitDone = false; jitStep = 0;
  btnStep.disabled = false; btnStep.textContent = "Step: parse Python";
  btnAuto.disabled = false; btnRun.disabled = true;
  document.querySelectorAll(".c-node, .c-arrow").forEach((el) => el.classList.remove("active"));
  inspectorPanel.classList.remove("visible");
  const fc = $("fused-col"); fc.classList.add("locked"); fc.classList.remove("highlight-pulse");
  resetRace();
  note.innerHTML = "Press <b>Step: parse Python</b> to walk the compile pipeline one stage at a time (or <b>Auto-compile</b> to run it through), inspecting the real jaxpr, StableHLO and fused HLO. The fused column unlocks once compilation finishes.";
  reportSize();
}

// --- Dashboards ---
function updateM(prefix, addTrips) {
  if (prefix === "u") uTrips += addTrips; else fTrips += addTrips;
  const trips = prefix === "u" ? uTrips : fTrips;
  const mb = trips * TENSOR_MB;
  const intensity = mb > 0 ? Math.round(FLOPS / mb) : 0;
  $(`${prefix}-trips`).textContent = trips;
  $(`${prefix}-mb`).textContent = mb.toFixed(1);
  $(`${prefix}-intensity`).textContent = intensity;
  if (addTrips > 0 && !REDUCE) {
    $(`${prefix}-stat-trips`).classList.add("highlight");
    $(`${prefix}-stat-mb`).classList.add("highlight");
    setTimeout(() => {
      $(`${prefix}-stat-trips`).classList.remove("highlight");
      $(`${prefix}-stat-mb`).classList.remove("highlight");
    }, 200);
  }
}

function finalizeM(prefix) {
  const trips = prefix === "u" ? uTrips : fTrips;
  const intensity = Math.round(FLOPS / (trips * TENSOR_MB));
  const isCompute = intensity > RIDGE;
  const boundEl = $(`${prefix}-bound`);
  boundEl.textContent = isCompute ? "compute-bound" : "memory-bound";
  boundEl.className = `m-bound ${isCompute ? "good" : "warn"}`;
  $(`${prefix}-stat-intensity`).classList.add("highlight");
}

function resetRace() {
  uTrips = 0; fTrips = 0;
  updateM("u", 0); updateM("f", 0);
  ["u", "f"].forEach((p) => {
    const b = $(`${p}-bound`); b.textContent = "waiting"; b.className = "m-bound";
    $(`${p}-stat-intensity`).classList.remove("highlight");
  });
  document.querySelectorAll(".op.active, .hbm-block.active").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".active-up, .active-down").forEach((el) => el.classList.remove("active-up", "active-down"));
}

// --- Animation primitives ---
async function hbmTrip(prefix, laneIdx, dir) {
  const lane = $(`${prefix}-hl-${laneIdx}`), block = $(`${prefix}-hbm-block`);
  block.classList.add("active");
  lane.classList.add(dir === "up" ? "active-up" : "active-down");
  await delay(400);
  lane.classList.remove("active-up", "active-down");
  block.classList.remove("active");
}
async function executeOp(prefix, opIdx, ms) {
  const op = $(`${prefix}-op-${opIdx}`);
  op.classList.add("active");
  await delay(ms);
  op.classList.remove("active");
}
async function vmemTransfer(prefix, laneIdx) {
  const vl = $(`${prefix}-vl-${laneIdx}`);
  vl.classList.add("active");
  await delay(200);
  vl.classList.remove("active");
}

// --- Execution runners ---
async function runUnfused() {
  await hbmTrip("u", 0, "up"); updateM("u", 2);
  await executeOp("u", 0, 300);
  await hbmTrip("u", 0, "down"); updateM("u", 1);
  await delay(50);
  for (let i = 1; i < 4; i++) {
    await hbmTrip("u", i, "up"); updateM("u", 1);
    await executeOp("u", i, 300);
    await hbmTrip("u", i, "down"); updateM("u", 1);
    await delay(50);
  }
  finalizeM("u");
}

async function runFused() {
  await hbmTrip("f", 0, "up"); updateM("f", 2);
  await executeOp("f", 0, 200); await vmemTransfer("f", 0);
  await executeOp("f", 1, 200); await vmemTransfer("f", 1);
  await executeOp("f", 2, 200); await vmemTransfer("f", 2);
  await executeOp("f", 3, 200);
  await hbmTrip("f", 3, "down"); updateM("f", 1);
  finalizeM("f");
}

async function runRace() {
  if (isRunning || !jitDone) return;
  isRunning = true; btnRun.disabled = true; btnReset.disabled = true;
  resetRace();
  note.innerHTML = "<i>Racing the two pipelines…</i>";
  sim.event("race-started", {});
  if (REDUCE) {
    uTrips = UNFUSED_TRIPS; fTrips = FUSED_TRIPS;
    updateM("u", 0); updateM("f", 0);
    finalizeM("u"); finalizeM("f");
  } else {
    await Promise.all([runUnfused(), runFused()]);
  }
  note.innerHTML = "<b>Done.</b> Same layer, same FLOPs — the fused kernel keeps intermediates in VMEM: <b>9 → 3</b> HBM round-trips, intensity <b>60 → 179</b> FLOP/byte, past the v5p ridge (165). The layer flips from <b>memory-bound</b> to <b>compute-bound</b>.";
  isRunning = false; btnRun.disabled = false; btnReset.disabled = false;
  if (!observedRace) { observedRace = true; sim.checkpoint("observe-fusion"); }
  sim.event("race-complete", { unfusedTrips: UNFUSED_TRIPS, fusedTrips: FUSED_TRIPS });
  reportSize();
}

btnStep.addEventListener("click", stepJit);
btnAuto.addEventListener("click", autoJit);
btnRun.addEventListener("click", runRace);
btnReset.addEventListener("click", resetAll);

const sim = createSim({
  onInit({ theme, reducedMotion }) { REDUCE = REDUCE || reducedMotion; applyTheme(theme); reportSize(); },
});

new ResizeObserver(() => reportSize()).observe(document.body);
setTimeout(() => { if (!sim.isInitialized()) reportSize(); }, 300);
