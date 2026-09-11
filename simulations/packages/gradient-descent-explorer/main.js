// createSim is a global from sim-sdk.js (classic script). Gradient descent on a simple
// elongated bowl  f(x,y) = ½(x² + k·y²)  (gradient = (x, k·y)). Start at a fixed point and step
// downhill; the learning rate sets the step size. Small → crawls; in-band → glides to the
// minimum; too big → overshoots the steep axis, the path flies off, the loss explodes (the NaN
// blow-up). Momentum smooths the zig-zag. No calculus shown. Deterministic, theme + reduced-motion
// aware, no CDNs.

let REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const K = 8;                       // steep axis (y); stability needs lr < 2(1+μ)/K: 0.25 without momentum
const START = [-0.9, 0.8];
const STEPS = 45;
const D = 1.3;                     // domain half-extent for the landscape
let lr = 0.12, mu = 0.0, observed = false;

const $ = (id) => document.getElementById(id);
const loss = (x, y) => 0.5 * (x * x + K * y * y);
// Heavy-ball descent on the steep axis is stable while lr·K < 2(1+μ); with μ = 0 that is the familiar 2/K.
const stableBelow = () => (2 * (1 + mu)) / K;
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 16)); }

function descend() {
  let [x, y] = START, vx = 0, vy = 0;
  const pts = [[x, y]], losses = [loss(x, y)];
  let diverged = false, oscillated = false;
  for (let i = 0; i < STEPS; i++) {
    const py = y;
    const gx = x, gy = K * y;                 // gradient of f
    vx = mu * vx - lr * gx; vy = mu * vy - lr * gy;
    x += vx; y += vy;
    if (py * y < 0 && Math.abs(y) > 0.02) oscillated = true;   // overshot the steep axis
    pts.push([x, y]); losses.push(loss(x, y));
    if (!isFinite(x) || !isFinite(y) || Math.hypot(x, y) > 3) { diverged = true; break; }
  }
  return { pts, losses, diverged, oscillated };
}

const W = 320, H = 300;
const mapX = (x) => ((x + D) / (2 * D)) * W;
const mapY = (y) => ((D - y) / (2 * D)) * H;

function landscapeSVG(pts, diverged) {
  let contours = "";
  for (const c of [0.1, 0.4, 1, 2, 4]) {
    const rx = Math.sqrt(2 * c) / D * (W / 2), ry = Math.sqrt(c / 4) / D * (H / 2);
    contours += `<ellipse class="contour" cx="${W / 2}" cy="${H / 2}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/>`;
  }
  const poly = pts.map(([x, y]) => `${mapX(x).toFixed(1)},${mapY(y).toFixed(1)}`).join(" ");
  const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="loss surface with the descent path">
      ${contours}
      <circle class="min-dot" cx="${W / 2}" cy="${H / 2}" r="4"/>
      <polyline class="path-line ${diverged ? "bad" : ""}" points="${poly}"/>
      <circle class="path-dot start" cx="${mapX(sx).toFixed(1)}" cy="${mapY(sy).toFixed(1)}" r="4"/>
      <circle class="path-dot ${diverged ? "end" : ""}" cx="${mapX(ex).toFixed(1)}" cy="${mapY(ey).toFixed(1)}" r="4"/>
    </svg>`;
}

function curveSVG(losses, regime) {
  const ml = 30, mb = 18, w = W - ml, h = H - mb;
  const lo = 1e-3, hi = Math.max(...losses.filter(isFinite), losses[0]) * 1.6;
  const lyx = (i) => ml + (i / (losses.length - 1)) * w;
  const lyy = (L) => {
    const v = Math.max(lo, Math.min(hi, isFinite(L) ? L : hi));
    return h - (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) * h;
  };
  const poly = losses.map((L, i) => `${lyx(i).toFixed(1)},${lyy(L).toFixed(1)}`).join(" ");
  const cls = regime === "diverging" ? "bad" : regime === "converging" ? "good" : "";
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="loss versus step">
      <line class="axis" x1="${ml}" y1="0" x2="${ml}" y2="${h}"/>
      <line class="axis" x1="${ml}" y1="${h}" x2="${W}" y2="${h}"/>
      <text class="axlabel" x="${ml}" y="${h + 14}">step 0</text>
      <text class="axlabel" x="${W}" y="${h + 14}" text-anchor="end">${losses.length - 1}</text>
      <text class="axlabel" x="2" y="12">loss</text>
      <text class="axlabel" x="2" y="${h}">low</text>
      <polyline class="curve-line ${cls}" points="${poly}"/>
    </svg>`;
}

function sl(name, id, val, min, max, step) {
  return `<div class="sl"><label for="${id}">${name} <b id="${id}-val">${val}</b></label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
}

// The sliders are built and wired once, never rebuilt: rebuilding them on every input
// event took keyboard focus off a slider after one step and cut drags short. render()
// refreshes only their value labels and the outputs (#59).
let mounted = false;
function mountControls() {
  $("controls").innerHTML = sl("Learning rate", "lr", lr.toFixed(3), 0.01, 0.35, 0.005)
    + sl("Momentum", "mu", mu.toFixed(2), 0, 0.9, 0.05);
  for (const id of ["lr", "mu"]) {
    $(id).addEventListener("input", (e) => {
      if (id === "lr") lr = +e.target.value; else mu = +e.target.value;
      if (!observed) { observed = true; sim.checkpoint("observe-divergence"); }
      sim.event("descent", { lr, mu });
      render();
    });
  }
  mounted = true;
}

function render() {
  if (!mounted) mountControls();
  $("lr-val").textContent = lr.toFixed(3);
  $("mu-val").textContent = mu.toFixed(2);

  const { pts, losses, diverged, oscillated } = descend();
  const l0 = losses[0], lEnd = losses[losses.length - 1];
  const regime = diverged ? "diverging" : (lEnd < 0.01 * l0 ? "converging" : "crawling");

  $("land").innerHTML = landscapeSVG(pts, diverged);
  $("curve").innerHTML = curveSVG(losses, regime);

  const note = $("note");
  note.className = "note " + (regime === "diverging" ? "bad" : regime === "converging" ? "good" : "");
  if (regime === "diverging")
    note.innerHTML = `Learning rate <b>${lr.toFixed(3)}</b> is <span class="reg bad">too big</span> — each step overshoots the steep walls of the valley, the path flies off, and the loss <b>explodes</b>. This is the <b>NaN blow-up</b>: the run is dead. (Stability here needs lr below ${stableBelow().toFixed(3)}${mu > 0 ? ` with momentum ${mu.toFixed(2)}` : ""}.)`;
  else if (regime === "converging" && oscillated)
    note.innerHTML = `Learning rate <b>${lr.toFixed(3)}</b> is <span class="reg good">in the band</span> but near the edge — it still reaches the minimum, but watch the path <b>zig-zag</b> across the steep walls of the valley. A smaller rate, or <b>momentum</b>, smooths it out.`;
  else if (regime === "converging")
    note.innerHTML = `Learning rate <b>${lr.toFixed(3)}</b> is <span class="reg good">in the band</span> — the path glides into the minimum and the loss drops smoothly. This is what you want${mu > 0 ? `, and momentum (${mu.toFixed(2)}) is straightening the path` : ""}.`;
  else
    note.innerHTML = `Learning rate <b>${lr.toFixed(3)}</b> is <span class="reg warn">stable but slow</span> — it's still creeping toward the minimum after ${STEPS} steps. Bigger steps go faster (until they overshoot); <b>momentum</b> can speed it up without raising the rate.`;

  reportSize();
}

const sim = createSim({
  onInit({ theme, reducedMotion }) { REDUCE = REDUCE || reducedMotion; applyTheme(theme); render(); },
});
new ResizeObserver(() => reportSize()).observe(document.body);
setTimeout(() => { if (!sim.isInitialized()) render(); }, 300);
