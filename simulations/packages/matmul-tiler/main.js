// createSim is a global from sim-sdk.js (classic script). A matmul [M,K]·[K,N] → [M,N] on a
// matrix unit that works in fixed 128×128 (or 256×256) tiles. Any dimension that isn't a multiple of
// the tile is zero-padded up to the next one — wasting compute (FLOPs on zeros) and memory
// (storing zeros), the classic surprise-OOM. Drag M/K/N and watch the overhang. Deterministic,
// theme-aware, reduced-motion safe, no CDNs.

let REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
let T = 128;                              // matrix-unit tile size
let M = 512, K = 512, N = 512;           // matmul dims
let observed = false;

const $ = (id) => document.getElementById(id);
const pad = (x) => Math.ceil(x / T) * T;
const fmt = (n) => n.toLocaleString("en-US");

function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 16)); }

function sliderHTML(name, val) {
  return `<div class="sl">
    <label for="s-${name}">${name} <b id="${name}-val"></b> <span class="pad" id="${name}-pad"></span></label>
    <input type="range" id="s-${name}" min="64" max="1024" step="1" value="${val}">
  </div>`;
}

// The sliders are built and wired once, never rebuilt: rebuilding them on every input
// event took keyboard focus off a slider after one step and cut drags short. render()
// refreshes only their labels and the outputs (#59).
let mounted = false;
function mountSliders() {
  $("sliders").innerHTML = sliderHTML("M", M) + sliderHTML("K", K) + sliderHTML("N", N);
  for (const name of ["M", "K", "N"]) {
    $(`s-${name}`).addEventListener("input", (e) => {
      const v = +e.target.value;
      if (name === "M") M = v; else if (name === "K") K = v; else N = v;
      render();
    });
  }
  mounted = true;
}

/** A slider's value and its padded size ("→ 512", or "→ 512 (aligned)"), updated in place. */
function updateSliderLabel(name, val) {
  const p = pad(val), wasted = p > val;
  $(`${name}-val`).textContent = String(val);
  const padEl = $(`${name}-pad`);
  padEl.textContent = `→ ${p}${wasted ? "" : " (aligned)"}`;
  padEl.className = `pad ${wasted ? "waste" : ""}`;
}

function vizSVG() {
  const Mp = pad(M), Np = pad(N);
  const maxpx = 300, scale = maxpx / Math.max(Mp, Np);
  const w = Np * scale, h = Mp * scale;
  const rw = N * scale, rh = M * scale;
  let grid = "";
  for (let x = T; x < Np; x += T) grid += `<line class="r-grid" x1="${x * scale}" y1="0" x2="${x * scale}" y2="${h}"/>`;
  for (let y = T; y < Mp; y += T) grid += `<line class="r-grid" x1="0" y1="${y * scale}" x2="${w}" y2="${y * scale}"/>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Output matrix ${M} by ${N}, padded to ${Mp} by ${Np}">
      <rect class="r-pad" x="0" y="0" width="${w}" height="${h}"/>
      <rect class="r-real" x="0" y="0" width="${rw}" height="${rh}"/>
      ${grid}
    </svg>`;
}

function render() {
  if (!mounted) mountSliders();
  document.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("on", +b.dataset.tile === T));
  updateSliderLabel("M", M);
  updateSliderLabel("K", K);
  updateSliderLabel("N", N);

  const Mp = pad(M), Kp = pad(K), Np = pad(N);
  const realFLOP = 2 * M * K * N, padFLOP = 2 * Mp * Kp * Np;
  const realMem = M * K + K * N + M * N, padMem = Mp * Kp + Kp * Np + Mp * Np;
  const flopWaste = +((padFLOP / realFLOP - 1) * 100).toFixed(0);
  const memWaste = +((padMem / realMem - 1) * 100).toFixed(0);
  const anyWaste = flopWaste > 0 || memWaste > 0;
  if (anyWaste && !observed) { observed = true; sim.checkpoint("observe-padding"); }

  $("viz").innerHTML = `<div class="vtitle">Output [M × N] on the tile grid</div>${vizSVG()}
    <div class="vlegend"><span><span class="sw real"></span>real ${M}×${N}</span><span><span class="sw pad"></span>padded zeros → ${Mp}×${Np}</span></div>`;

  $("dashboard").innerHTML = `
    <div class="d-row"><span class="d-k">Padded dims (M·K·N)</span><span class="d-v mono">${Mp}·${Kp}·${Np}</span></div>
    <div class="d-row"><span class="d-k">Wasted compute</span><span class="d-v ${flopWaste > 0 ? "waste" : "ok"}">${flopWaste}%</span></div>
    <div class="d-row"><span class="d-k">Wasted memory</span><span class="d-v ${memWaste > 0 ? "waste" : "ok"}">${memWaste}%</span></div>`;

  $("note").innerHTML = anyWaste
    ? `Your <code>${M}×${K}×${N}</code> matmul pads to <code>${Mp}×${Kp}×${Np}</code> — <b>${flopWaste}% of the compute</b> and <b>${memWaste}% of the memory</b> go to padded zeros. That extra memory is the <b>surprise OOM</b>: a job that "should fit" doesn't. Round the dims to multiples of <b>${T}</b> to recover it.`
    : `Every dimension is a multiple of <b>${T}</b> — <b>no padding, no waste</b>. This is the shape you want: the matmul fills whole tiles, so you pay only for the math you asked for.`;

  reportSize();
}

document.querySelectorAll(".seg-btn").forEach((b) => b.addEventListener("click", () => { T = +b.dataset.tile; render(); }));

const sim = createSim({
  onInit({ theme, reducedMotion }) { REDUCE = REDUCE || reducedMotion; applyTheme(theme); render(); },
});
new ResizeObserver(() => reportSize()).observe(document.body);
setTimeout(() => { if (!sim.isInitialized()) render(); }, 300);
