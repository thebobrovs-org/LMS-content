// createSim is a global from sim-sdk.js (classic script). "Chasing the bottleneck":
// a chip-styled stepper through TPU generations, each with the wall it hit and the
// fix it shipped, plus a log-scale pod-performance chart (and the 8th-gen split).
// Theme-aware, SDK-wired, no CDNs. Deterministic.
const app = document.getElementById("app");

const GENS = [
  { id: "v1", label: "V1", wall: "General-purpose CPUs and GPUs were too slow and power-hungry for Google's massive internal inference workloads.", fix: "Built a dedicated, matrix-multiply ASIC strictly for internal inference.", note: "Baseline · Inference only", podMult: null, isSplit: false },
  { id: "v2", label: "V2", wall: "A single chip couldn't train large models efficiently; training needed massive synchronized memory.", fix: "Added distributed shared memory to create the first multi-chip Pods. The training era begins.", note: "1×/chip · 1×/pod", podMult: 1, isSplit: false },
  { id: "v3", label: "V3", wall: "Rising compute density generated too much heat, breaking traditional air-cooled data centers.", fix: "Introduced liquid cooling directly to the racks — denser, hotter chips.", note: "≈3×/chip · 12×/pod", podMult: 12, isSplit: false },
  { id: "v4", label: "V4", wall: "Pods grew too large; static copper wiring caused reliability issues and a network scaling wall.", fix: "Introduced Optical Circuit Switches (OCS) to reconfigure slices and route around dead chips.", note: "≈6.6×/chip · 100×/pod", podMult: 100, isSplit: false },
  { id: "v5", label: "v5p", wall: "A single architecture couldn't deliver both peak performance and cost-efficiency.", fix: "Silicon split into variants — v5e (efficiency) and v5p (performance). v5p is tuned for 3D-torus training.", note: "21×/chip · 750×/pod", podMult: 750, isSplit: false },
  { id: "v6e", label: "Trillium", wall: "Demand for extreme cost-efficiency for inference and mid-scale training.", fix: "Trillium (v6e) delivered next-gen efficiency, ≈100× the performance of V2 on a 2D torus.", note: "v6e · ≈100× of V2 (efficiency)", podMult: 100, isSplit: false },
  { id: "v7", label: "Ironwood", wall: "Frontier models demanded unprecedented raw pod-scale limits.", fix: "A massive networking push lets the TPU 7x variant scale up to 9,216 chips per pod on a 3D torus.", note: "TPU 7x · up to 9,216 chips/pod", podMult: 2500, isSplit: false },
  { id: "v8", label: "8th gen", wall: "Pre-training (throughput, embeddings) and serving (KV cache, low-latency collectives) bottlenecks fundamentally diverged. One chip couldn't do both.", fix: "Hard silicon split: TPU 8t (SparseCore, 3D torus) for training vs TPU 8i (CAE, Boardfly) for inference.", note: "8t (training) & 8i (inference)", podMult: 4000, isSplit: true },
];

const ICONS = {
  wall: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  fix: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

let i = 0;
let observed = false;

function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8)); }
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function selectGen(n) {
  i = Math.max(0, Math.min(GENS.length - 1, n));
  if (i === GENS.length - 1 && !observed) { observed = true; sim.checkpoint("observe-evolution"); }
  sim.event("generation", { gen: GENS[i].id });
  render();
}

/**
 * The focused control, as a selector for its replacement, so that it takes focus again after a render writes the
 * controls anew (LMS-content#135, as tpu-vm-anatomy does, #130); null when focus is elsewhere.
 */
function focusedControl() {
  const el = document.activeElement;
  if (!el || !app.contains(el)) return null;
  for (const attr of ["data-i", "data-act"]) {
    const value = el.getAttribute(attr);
    if (value !== null) return `[${attr}="${value}"]`;
  }
  return el.id ? `#${el.id}` : null;
}
/** Focus the control again after a render; when it's now disabled (the last step's Next, the first step's Prev), the other step button. */
function restoreFocus(sel) {
  if (!sel) return;
  const same = app.querySelector(sel);
  const other = app.querySelector(sel === '[data-act="next"]' ? '[data-act="prev"]' : '[data-act="next"]');
  const target = same && !same.disabled ? same : other;
  if (target && !target.disabled) target.focus();
}

function render() {
  const focused = focusedControl();
  const g = GENS[i];
  const progressPct = (i / (GENS.length - 1)) * 100;
  const MAX_LOG = Math.log10(5000);

  const nodes = GENS.map((gen, n) => `
    <button class="node ${n === i ? "active" : ""} ${n < i ? "past" : ""}" data-i="${n}" aria-label="Go to ${gen.label}"${n === i ? ' aria-current="step"' : ""}>
      <div class="node-chip"></div><div class="node-label">${gen.label}</div>
    </button>`).join("");

  const bars = GENS.map((gen, n) => {
    const active = n === i;
    const h = gen.podMult ? Math.max(8, (Math.log10(Math.max(1, gen.podMult)) / MAX_LOG) * 100) : 10;
    const val = gen.podMult ? (gen.podMult >= 1000 ? "Max scale" : `${gen.podMult}×`) : "";
    if (gen.isSplit) {
      return `<div class="chart-bar-group">
          <div class="split-container ${active ? "active" : ""}">
            <div class="bar split-train" style="height:${h}%"><span class="split-label">8t</span></div>
            <div class="bar split-infer" style="height:${h}%"><span class="split-label">8i</span></div>
          </div>
          <div class="bar-val" style="bottom:${h}%">${val}</div>
        </div>`;
    }
    return `<div class="chart-bar-group">
        <div class="bar ${active ? "active" : ""}" style="height:${h}%"></div>
        <div class="bar-val" style="bottom:${h}%">${val}</div>
      </div>`;
  }).join("");

  app.innerHTML = `
    <nav class="timeline-track" aria-label="TPU generations">
      <div class="timeline-line"></div>
      <div class="timeline-progress" style="width:${progressPct}%"></div>
      ${nodes}
    </nav>

    <div class="story-container">
      <div class="panel wall">
        <div class="panel-header"><div class="panel-icon">${ICONS.wall}</div> The bottleneck</div>
        <div class="panel-text animate-content">${g.wall}</div>
      </div>
      <div class="panel fix">
        <div class="panel-header"><div class="panel-icon">${ICONS.fix}</div> The fix</div>
        <div class="panel-text animate-content">${g.fix}</div>
        <div class="panel-sub animate-content">&gt; ${g.note}</div>
      </div>
    </div>

    <div class="chart-section">
      <div class="chart-header">
        <div class="chart-title">Pod performance multiplier <span style="font-weight:400;color:var(--muted);font-size:12px;">(vs V2 baseline)</span></div>
        <div class="chart-axis">Log scale ↑</div>
      </div>
      <div class="chart-area">${bars}</div>
    </div>

    <div class="controls">
      <button class="btn" data-act="reset">↺ Reset</button>
      <div class="btn-group">
        <button class="btn" data-act="prev" ${i === 0 ? "disabled" : ""}>← Prev</button>
        <button class="btn primary" data-act="next" ${i === GENS.length - 1 ? "disabled" : ""}>Next gen →</button>
      </div>
    </div>`;

  app.querySelectorAll(".node").forEach((el) => el.addEventListener("click", () => selectGen(+el.getAttribute("data-i"))));
  app.querySelector('[data-act="reset"]').addEventListener("click", () => selectGen(0));
  app.querySelector('[data-act="prev"]').addEventListener("click", () => selectGen(i - 1));
  app.querySelector('[data-act="next"]').addEventListener("click", () => selectGen(i + 1));
  restoreFocus(focused);
  reportSize();
}

const sim = createSim({ onInit({ theme }) { applyTheme(theme); render(); } });
setTimeout(() => { if (!sim.isInitialized() && app.innerHTML === "") render(); }, 300);
