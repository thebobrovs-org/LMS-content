// createSim is a global from sim-sdk.js (classic script). A guided GPU-or-TPU
// decision tree: answer a few questions and read off the verdict + why. The point
// is that it isn't "TPU always wins" — CUDA kernels, small/varied work, or no TPU
// capacity all route to a GPU. Deterministic, theme-aware, no CDNs.
const app = document.getElementById("app");

const TREE = {
  start: {
    q: "What is your model code optimized for?",
    opts: [
      { label: "JAX / PyTorch-XLA (TPU-native)", next: "scale" },
      { label: "CUDA / GPU-specific kernels", next: "kernels" },
      { label: "A portable framework, no custom kernels", next: "xla" },
    ],
  },
  kernels: {
    q: "Does it depend on hand-tuned CUDA kernels or GPU-only ops?",
    opts: [
      { label: "Yes", verdict: "gpu", why: "Hand-tuned CUDA kernels don't port through XLA — stay on the GPU." },
      { label: "No", next: "xla" },
    ],
  },
  xla: {
    q: "XLA can compile it (with some code changes). Is the workload large-scale and matmul-heavy?",
    opts: [
      { label: "Yes — large-scale training / serving", next: "scale" },
      { label: "No — smaller, varied, experimental", verdict: "gpu", why: "Broad framework support and easy availability favour a GPU for smaller, varied work." },
    ],
  },
  scale: {
    q: "Can you reliably get the TPU capacity you need (quota / region)?",
    opts: [
      { label: "Yes", verdict: "tpu", why: "TPU-ready + large-scale → top performance and cost-per-FLOP at pod scale." },
      { label: "Not reliably", verdict: "gpu", why: "Without TPU capacity, a GPU is the available fallback — or run both and switch (interoperability, covered in L300)." },
    ],
  },
};

const VERDICTS = {
  tpu: { label: "TPU", tone: "tpu" },
  gpu: { label: "GPU", tone: "gpu" },
};

let node = "start";
let trail = []; // { q, choice }
let observed = false;

function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8)); }
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function choose(i) {
  const cur = TREE[node];
  const opt = cur.opts[i];
  trail.push({ q: cur.q, choice: opt.label });
  if (opt.verdict) {
    node = "verdict:" + opt.verdict;
    verdictWhy = opt.why;
    if (!observed) { observed = true; sim.checkpoint("observe-decision"); }
    sim.event("verdict", { verdict: opt.verdict });
  } else {
    node = opt.next;
  }
  render(true);
}
let verdictWhy = "";

function restart() { node = "start"; trail = []; verdictWhy = ""; render(true); }

/**
 * An answer replaces the buttons it was given on, so when a choice or Start over rendered the view,
 * focus moves to what replaced them: the next question, or the verdict. A keyboard user carries on
 * from there instead of from the top of the page (LMS-content#122). The first render moves no focus.
 */
function render(moveFocus = false) {
  const trailHtml = trail.length
    ? `<ol class="trail">${trail.map((t) => `<li><span class="tq">${t.q}</span><span class="ta">${t.choice}</span></li>`).join("")}</ol>`
    : "";

  let body;
  if (node.startsWith("verdict:")) {
    const v = VERDICTS[node.split(":")[1]];
    body = `
      <div class="verdict ${v.tone}">
        <div class="vlabel" id="step-focus" tabindex="-1">Use a <b>${v.label}</b></div>
        <div class="vwhy">${verdictWhy}</div>
      </div>
      <button class="restart" id="restart">↺ Start over</button>`;
  } else {
    const cur = TREE[node];
    body = `
      <div class="qcard">
        <div class="qnum">Question ${trail.length + 1}</div>
        <div class="qtext" id="step-focus" tabindex="-1">${cur.q}</div>
        <div class="opts">
          ${cur.opts.map((o, i) => `<button class="opt" data-i="${i}">${o.label}</button>`).join("")}
        </div>
      </div>`;
  }

  app.innerHTML = `
    <div class="hint">It isn't "TPU always wins." Walk the tree — your framework, whether <b>XLA</b> can compile it, the workload, and whether you can <b>get</b> the chips all steer the answer.</div>
    ${trailHtml}
    ${body}`;

  app.querySelectorAll(".opt").forEach((el) => el.addEventListener("click", () => choose(+el.getAttribute("data-i"))));
  const r = app.querySelector("#restart");
  if (r) r.addEventListener("click", restart);
  if (moveFocus) document.getElementById("step-focus").focus();
  reportSize();
}

const sim = createSim({ onInit({ theme }) { applyTheme(theme); render(); } });
setTimeout(() => { if (!sim.isInitialized() && app.innerHTML === "") render(); }, 300);
