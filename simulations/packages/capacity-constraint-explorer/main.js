// createSim is a global from sim-sdk.js (classic script). A system of two constraints, drawn as two
// lines on a CPU-vs-GPU chart: rack capacity (C + G = cap) and budget (C + 4G = budget). The solution
// is where they cross — the one valid config. The same rules, with variable names stripped, ARE the
// matrix [[1,1],[1,4]]. Toggle "conflicting" to make the lines parallel → singular → no solution.
// Foundational literacy: a matrix is a list of coefficients. (ML uses matrices as transformations,
// not solved systems — that's a separate idea.) Deterministic, theme + reduced-motion aware, no CDNs.

const $ = (id) => document.getElementById(id);
const CMAX = 40, GMAX = 40;
let cap = 40, budget = 100, singular = false, observed = false;
let REDUCE = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const W = 360, H = 320, padL = 42, padT = 14, padR = 14, padB = 34;
const plotW = W - padL - padR, plotH = H - padT - padB;
const cx = (c) => padL + (c / CMAX) * plotW;
const cy = (g) => (H - padB) - (g / GMAX) * plotH;
const fmt = (n) => (Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n).toString() : n.toFixed(1));

function applyTheme(t) { if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 16)); }

function solve() {
  if (singular) return null;                 // parallel lines: no unique solution
  const G = (budget - cap) / 3;              // from C+G=cap, C+4G=budget
  const C = cap - G;
  return { C, G };
}

function chartSVG() {
  const cap2 = cap + 15; // the conflicting (parallel) second rule in singular mode
  let grid = "";
  for (let v = 0; v <= 40; v += 10) {
    grid += `<line class="grid" x1="${cx(v)}" y1="${cy(0)}" x2="${cx(v)}" y2="${cy(40)}"/>`;
    grid += `<line class="grid" x1="${cx(0)}" y1="${cy(v)}" x2="${cx(40)}" y2="${cy(v)}"/>`;
    grid += `<text class="axlab" x="${cx(v)}" y="${H - padB + 14}" text-anchor="middle">${v}</text>`;
    if (v > 0) grid += `<text class="axlab" x="${padL - 6}" y="${cy(v) + 3}" text-anchor="end">${v}</text>`;
  }
  // capacity line C+G=cap
  const capL = `<line class="line-cap" x1="${cx(0)}" y1="${cy(cap)}" x2="${cx(CMAX)}" y2="${cy(cap - CMAX)}"/>`;
  // second line: budget (solvable) or parallel capacity (singular)
  const budL = singular
    ? `<line class="line-bud sing" x1="${cx(0)}" y1="${cy(cap2)}" x2="${cx(CMAX)}" y2="${cy(cap2 - CMAX)}"/>`
    : `<line class="line-bud" x1="${cx(0)}" y1="${cy(budget / 4)}" x2="${cx(CMAX)}" y2="${cy((budget - CMAX) / 4)}"/>`;
  const s = solve();
  let dot = "";
  if (s && s.C >= 0 && s.C <= CMAX && s.G >= 0 && s.G <= GMAX) {
    dot = `<circle class="xsol-ring ${REDUCE ? "" : "xsol-pulse"}" cx="${cx(s.C)}" cy="${cy(s.G)}" r="9"/><circle class="xsol" cx="${cx(s.C)}" cy="${cy(s.G)}" r="4.5"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="CPUs vs GPUs chart with two constraint lines and their intersection">
    <defs><clipPath id="plot"><rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}"/></clipPath></defs>
    ${grid}
    <line class="axis" x1="${cx(0)}" y1="${cy(0)}" x2="${cx(0)}" y2="${cy(40)}"/>
    <line class="axis" x1="${cx(0)}" y1="${cy(0)}" x2="${cx(40)}" y2="${cy(0)}"/>
    <g clip-path="url(#plot)">${capL}${budL}${dot}</g>
    <text class="axlab" x="${cx(20)}" y="${H - 4}" text-anchor="middle">CPUs (C) →</text>
    <text class="axlab" x="12" y="${cy(20)}" text-anchor="middle" transform="rotate(-90,12,${cy(20)})">GPUs (G) →</text>
  </svg>`;
}

function codeHTML() {
  const s = solve();
  if (singular) {
    const cap2 = cap + 15;
    return `<span class="kw">import</span> numpy <span class="kw">as</span> np
A <span class="op">=</span> np.array([[1, 1],   <span class="cm"># C + G</span>
              [1, 1]])  <span class="cm"># C + G  ← same coefficients!</span>
b <span class="op">=</span> np.array([${cap}, ${cap2}])
np.linalg.solve(A, b)
<span class="bad"># LinAlgError: Singular matrix</span>`;
  }
  return `<span class="kw">import</span> numpy <span class="kw">as</span> np
A <span class="op">=</span> np.array([[1, 1],   <span class="cm"># C + G   (rack nodes)</span>
              [1, 4]])  <span class="cm"># C + 4G  (budget, $k)</span>
b <span class="op">=</span> np.array([${cap}, ${budget}])
np.linalg.solve(A, b)   <span class="hl"># → [${s ? fmt(s.C) : "?"}, ${s ? fmt(s.G) : "?"}]</span>`;
}

let mounted = false;

/**
 * The controls are built once, so the one a keyboard user moves keeps focus; a change updates their
 * value labels and redraws the outputs in place (LMS-content#122, as #59 did for the sliders of five
 * other simulations).
 */
function mount() {
  $("controls").innerHTML =
    `<div class="sl cap"><label for="c-cap">Rack capacity (nodes) <b id="cap-val">${cap}</b></label><input type="range" id="c-cap" min="10" max="40" step="1" value="${cap}"></div>` +
    `<div class="sl bud"><label for="c-bud">Budget ($k) <b id="bud-val">${budget}</b></label><input type="range" id="c-bud" min="40" max="160" step="2" value="${budget}"></div>` +
    `<label class="toggle"><input type="checkbox" id="c-sing"><span>Conflicting constraints (singular)</span></label>`;
  $("note").innerHTML = `A <b>matrix</b> is just those coefficients — the <code>1</code>s and <code>4</code> — stored for a computer; the variable names <code>C</code>, <code>G</code> are stripped away. The <b>solution</b> is where the rules agree. <b>Heads-up:</b> neural-net ML uses matrices as <i>learned transformations</i> (matmul), not systems it solves — solving systems like this lives in classical ML and optimization. This lesson is about reading a matrix concretely.`;
  $("c-cap").addEventListener("input", (e) => { cap = +e.target.value; render(); });
  const bud = $("c-bud"); if (bud) bud.addEventListener("input", (e) => { budget = +e.target.value; render(); });
  $("c-sing").addEventListener("change", (e) => {
    singular = e.target.checked;
    if (singular && !observed) { observed = true; sim.checkpoint("observe-singular"); }
    sim.event("mode", { singular });
    render();
  });
  mounted = true;
}

function render() {
  if (!mounted) mount();
  $("cap-val").textContent = String(cap);
  $("bud-val").textContent = String(budget);
  $("c-bud").disabled = singular;
  $("c-sing").checked = singular;

  $("banner").className = "banner" + (singular ? " show" : "");
  $("banner").innerHTML = singular ? `<b>Impossible deployment.</b> The two rules are parallel — they never cross, so no CPU/GPU config satisfies both. That's a <b>singular matrix</b>: no unique solution.` : "";

  $("chart").innerHTML = chartSVG();

  const s = solve();
  const cap2 = cap + 15;
  const sentence2 = singular
    ? `<div class="s bud sing"><span class="dot"></span>Rule 2 (conflicting): <code>C + G = ${cap2}</code></div>`
    : `<div class="s bud"><span class="dot"></span>Budget — $1k/CPU, $4k/GPU, $${budget}k: <code>C + 4G = ${budget}</code></div>`;
  const solHTML = (s && s.C >= 0 && s.G >= 0)
    ? `<div class="sol ok">Valid config: <b>${fmt(s.C)} CPUs, ${fmt(s.G)} GPUs</b> — the one point on both lines.</div>`
    : `<div class="sol no">No valid config — the constraints <b>${singular ? "conflict (parallel lines)" : "don't meet in the positive range"}</b>.</div>`;

  $("info").innerHTML = `
    <div class="sent">
      <div class="s cap"><span class="dot"></span>Rack — total nodes: <code>C + G = ${cap}</code></div>
      ${sentence2}
    </div>
    ${solHTML}
    <div class="code" tabindex="0" role="region" aria-label="The code for this plan (scrollable)">${codeHTML()}</div>`;

  reportSize();
}

const sim = createSim({ onInit({ theme, reducedMotion }) { REDUCE = REDUCE || reducedMotion; applyTheme(theme); render(); } });
new ResizeObserver(() => reportSize()).observe(document.body);
setTimeout(() => { if (!sim.isInitialized()) render(); }, 300);
