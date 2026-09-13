// createSim is a global from sim-sdk.js (classic script). An interactive cutaway of
// the host VM + TPU chip, across generations (v3 → v5p → Trillium → 8t → 8i). Click a
// block to inspect it; toggle the generation to watch the silicon change (HBM, VMEM,
// SparseCore↔CAE, ICI topology, MXU size). Deterministic, theme-aware, SDK-wired, no CDNs.
const app = document.getElementById("app");

const PARTS = {
  host: { name: "Host VM", role: "The Linux host VM you SSH into (root). Your JAX or PyTorch/XLA code runs here and dispatches to the chip — no per-operation network hop to the accelerator.", spec: "x86 / Arm Axion host VM · root SSH" },
  pcie: { name: "PCIe", role: "The link between the host and the TPU chip. Your program crosses here to launch; the heavy compute then stays strictly on the chip.", spec: "PCIe (host ↔ chip)" },
  chip: { name: "TPU Chip", role: "Google's ML ASIC. It bundles TensorCores, HBM, ICI, and workload-specific routing hardware. It cannot run general-purpose applications.", spec: "Application-specific integrated circuit" },
  tensorcore: { name: "TensorCore", role: "The central compute core. Each bundles multiple MXUs for matrix math, a vector unit for element-wise ops, and a scalar unit for control flow.", spec: "MXU + VPU/VMEM + scalar/SMEM" },
  scalar: { name: "Scalar Unit", role: "Runs control flow and computes the memory addresses that feed the vector and matrix units.", spec: "scalar control + addressing" },
  smem: { name: "SMEM", role: "Scalar Memory. The small on-chip scratchpad the scalar unit works from.", spec: "scalar scratchpad" },
  vpu: { name: "VPU", role: "Vector Processing Unit. Handles the non-matmul math: activations, softmax, normalization, elementwise ops. It's why real utilization (MFU) sits below the MXU's peak.", spec: "SIMD vector ALU" },
  vmem: { name: "VMEM", role: "Vector Memory. An on-chip scratchpad kept extremely close to compute; staging tensors here keeps the hungry MXUs fed.", spec: "vector scratchpad" },
  mxu: { name: "MXU", role: "Matrix Multiply Unit. The physical systolic array where matmuls run. This is where the vast majority of your model's FLOPs happen.", spec: "systolic array MACs" },
  hbm: { name: "HBM", role: "High-Bandwidth Memory. On-package DRAM shared by the TensorCores. Keeping the MXUs fed from HBM is the whole performance game — that's arithmetic intensity.", spec: "" },
  sparsecore: { name: "SparseCore", role: "A specialized dataflow unit that accelerates very large embedding lookups — the heavy part of recommendation/ranking and Mixture of Experts (MoE) routing.", spec: "Accelerates embeddings + MoE" },
  cae: { name: "CAE", role: "Collectives Acceleration Engine. Replaces SparseCores on inference-focused chips to aggregate results across cores with near-zero latency. Cuts on-chip collective latency ~5×.", spec: "−5× collective latency" },
  ici: { name: "ICI", role: "Inter-Chip Interconnect. High-speed custom optical/copper links wiring chips into a slice and Pod, bypassing the host network entirely. Collectives ride these.", spec: "Dedicated chip-to-chip network" },
};

let selected = "chip";
let gen = "8t";
let observed = false;

function reportSize() { requestAnimationFrame(() => { if (window.sim) sim.resize(document.body.scrollHeight + 8); }); }
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function hbmGB() {
  if (gen === "8i") return "288";
  if (gen === "8t") return "216";
  if (gen === "v5p") return "95";
  if (gen === "v6e") return "32";
  if (gen === "v3") return "32";
  return "";
}

function detail() {
  const base = PARTS[selected] || PARTS.chip;
  if (selected === "vmem") {
    return { ...base, spec: gen === "8i" ? "384 MB (3×) — holds the KV cache entirely on-chip" : "vector scratchpad memory" };
  }
  if (selected === "hbm") {
    let s = "";
    if (gen === "8i") s = "288 GB @ ≈8.6 TB/s";
    else if (gen === "8t") s = "216 GB @ ≈6.5 TB/s";
    else if (gen === "v5p") s = "95 GB @ ≈2.8 TB/s";
    else if (gen === "v6e") s = "32 GB HBM";
    else if (gen === "v3") s = "32 GB @ ≈900 GB/s";
    return { ...base, spec: s };
  }
  if (selected === "ici") {
    return { ...base, spec: gen === "8i" ? "Boardfly topology (~7 hops / 1,024 chips)" : (gen === "v6e" || gen === "v3" ? "2D torus" : "3D torus") };
  }
  if (selected === "mxu") {
    // 128×128 up through v5p; 256×256 from Trillium (v6e) onward.
    const small = gen === "v5p" || gen === "v3";
    return { ...base, spec: small ? "128×128 · 16,384 MACs/cycle" : "256×256 · 65,536 MACs/cycle" };
  }
  return base;
}

function select(part) {
  selected = part;
  if (part === "mxu" && !observed && window.sim) { observed = true; sim.checkpoint("observe-anatomy"); }
  if (window.sim) sim.event("inspect", { part });
  render();
}

function switchGen(g) {
  if (g === gen) return;
  if (selected === "sparsecore" && (g === "8i" || g === "v3")) selected = "chip";
  else if (selected === "cae" && g !== "8i") selected = "chip";
  gen = g;
  if (window.sim) sim.event("workload", { gen });
  render();
}

function cls(id) { return `part ${selected === id ? "sel" : ""}`; }

function tensorCore() {
  const vmemLabel = gen === "8i" ? `VMEM <span class="x3">3×</span>` : "VMEM";
  return `
    <div class="${cls("tensorcore")}" data-part="tensorcore" role="group" aria-label="TensorCore">
      <div class="tc-label" data-part="tensorcore" tabindex="0" role="button">TensorCore</div>
      <div class="tc-units">
        <div class="${cls("scalar")} u" data-part="scalar" tabindex="0" role="button">Scalar</div>
        <div class="${cls("smem")} u" data-part="smem" tabindex="0" role="button">SMEM</div>
        <div class="${cls("vpu")} u" data-part="vpu" tabindex="0" role="button">VPU</div>
        <div class="${cls("vmem")} u ${gen === "8i" ? "big" : ""}" data-part="vmem" tabindex="0" role="button">${vmemLabel}</div>
      </div>
      <div class="mxus">
        ${[0, 1, 2, 3].map(() => `<div class="${cls("mxu")} mxu" data-part="mxu" tabindex="0" role="button">MXU</div>`).join("")}
      </div>
    </div>`;
}

function bottomRow() {
  if (["8t", "v5p", "v6e"].includes(gen)) {
    return `<div class="sparse">
        <div class="${cls("sparsecore")} sc" data-part="sparsecore" tabindex="0" role="button">SparseCore</div>
        <div class="${cls("sparsecore")} sc" data-part="sparsecore" tabindex="0" role="button">SparseCore</div>
      </div>`;
  } else if (gen === "8i") {
    return `<div class="sparse">
      <div class="${cls("cae")} sc cae" data-part="cae" tabindex="0" role="button">CAE — Collectives Acceleration Engine</div>
    </div>`;
  }
  return `<div class="sparse"><div class="sc" style="background:transparent;border:2px dashed var(--border);color:var(--muted);cursor:default;">No SparseCores (introduced in v4)</div></div>`;
}

function render() {
  const d = detail();
  const hbmStr = hbmGB();

  let genNote = "";
  if (gen === "8t") genNote = "<strong>TPU 8t (training):</strong> SparseCores for embeddings, native FP4 precision, wired in a 3D-torus network.";
  else if (gen === "8i") genNote = "<strong>TPU 8i (inference):</strong> SparseCores replaced by <strong>CAE</strong> (−5× collective latency). VMEM tripled to 384 MB for the KV cache. Uses the Boardfly network.";
  else if (gen === "v5p") genNote = "<strong>TPU v5p (training):</strong> high-performance training chip optimized for pod-scale 3D-torus configurations.";
  else if (gen === "v6e") genNote = "<strong>TPU v6e (Trillium):</strong> cost-efficient inference and mid-scale training; MXU widened to 256×256, wired in a 2D torus.";
  else if (gen === "v3") genNote = "<strong>TPU v3 (legacy):</strong> before v4 there were no SparseCores — the matrix units had to absorb heavy embedding lookups, a severe bottleneck for recommendation models.";

  app.innerHTML = `
    <div class="topbar">
      <div class="gentabs" role="tablist">
        <button class="gtab ${gen === "v3" ? "on" : ""}" data-gen="v3" role="tab">v3 (legacy)</button>
        <button class="gtab ${gen === "v5p" ? "on" : ""}" data-gen="v5p" role="tab">v5p (train)</button>
        <button class="gtab ${gen === "v6e" ? "on" : ""}" data-gen="v6e" role="tab">Trillium (infer)</button>
        <button class="gtab ${gen === "8t" ? "on" : ""}" data-gen="8t" role="tab">8t (train)</button>
        <button class="gtab ${gen === "8i" ? "on" : ""}" data-gen="8i" role="tab">8i (infer)</button>
      </div>
      <span class="hint">Toggle the architectures to watch the silicon change.</span>
    </div>

    <div class="stage">
      <div class="${cls("host")} side host" data-part="host" tabindex="0" role="button">Host</div>
      <div class="arr">↔</div>
      <div class="${cls("pcie")} side pcie" data-part="pcie" tabindex="0" role="button">PCIe</div>

      <div class="chip">
        <div class="cores">${tensorCore()}${tensorCore()}</div>
        <div class="${cls("hbm")} hbm" data-part="hbm" tabindex="0" role="button">HBM ${hbmStr} GB</div>
        ${bottomRow()}
        <div class="chip-name">TPU ${gen === "v6e" ? "Trillium" : gen.toUpperCase()}</div>
      </div>

      <div class="arr">↔</div>
      <div class="${cls("ici")} side ici" data-part="ici" tabindex="0" role="button">ICI</div>
      <div class="arr">↔</div>
      <div class="${cls("chip")} side neighbor" data-part="chip" tabindex="0" role="button">Chip</div>
    </div>

    <div class="gennote">${genNote}</div>

    <div class="detail" role="status">
      <div class="dname">${d.name}</div>
      <div class="drole">${d.role}</div>
      <div class="dspec">${d.spec}</div>
    </div>`;

  app.querySelectorAll(".gtab").forEach((el) => el.addEventListener("click", () => switchGen(el.getAttribute("data-gen"))));
  // Every part selects on click (the TensorCore frame too, for the mouse); only the focusable parts
  // take the keyboard, and a key press never bubbles on to the frame the unit sits in (#98).
  app.querySelectorAll("[data-part]").forEach((el) => {
    const part = el.getAttribute("data-part");
    el.addEventListener("click", (e) => { e.stopPropagation(); select(part); });
    if (el.getAttribute("tabindex") === null) return;
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      e.stopPropagation();
      select(part);
    });
  });
  reportSize();
}

window.sim = typeof createSim !== "undefined" ? createSim({ onInit({ theme }) { applyTheme(theme); render(); } }) : null;
setTimeout(() => { if ((!window.sim || !sim.isInitialized()) && app.innerHTML === "") render(); }, 300);
