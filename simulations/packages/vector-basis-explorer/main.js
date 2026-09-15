// createSim is a global from sim-sdk.js (classic script). An arrow in 3-D space drawn in a simple
// isometric view. Its orthogonal projections onto the X, Y and Z axes (the "shadows") are its
// components — and those numbers ARE the array [x, y, z] the computer stores. The point: in ML a
// tensor is just that list of numbers; the geometry is where it comes from. Default (4, 3, 0) is a
// nod to Dan Fleisch's "What's a Tensor?". Deterministic, theme + reduced-motion aware, no CDNs.

const $ = (id) => document.getElementById(id);
let cx = 4, cy = 3, cz = 0, observed = false;

// --- cabinet projection: X right, Y receding up-right (half-scale), Z up -----------------------
const AX = 5, U = 30, D = 16, ANG = 40 * Math.PI / 180;
const DX = D * Math.cos(ANG), DY = D * Math.sin(ANG);
const OX = 120, OY = 215, W = 430, H = 250;
const P = (x, y, z) => [OX + x * U + y * DX, OY - z * U - y * DY];
const xy = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 16)); }

function head(p1, p2, cls, size = 9) {
  const a = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  const a1 = a + Math.PI * 0.82, a2 = a - Math.PI * 0.82;
  const h1 = [p2[0] + size * Math.cos(a1), p2[1] + size * Math.sin(a1)];
  const h2 = [p2[0] + size * Math.cos(a2), p2[1] + size * Math.sin(a2)];
  return `<polyline class="${cls}" points="${xy(h1)} ${xy(p2)} ${xy(h2)}"/>`;
}

function sceneSVG() {
  const O = P(0, 0, 0);
  let g = "";

  // faint floor grid on z=0
  for (let i = 0; i <= AX; i++) {
    g += `<line class="grid-line" x1="${xy(P(i, 0, 0)).split(",")[0]}" y1="${xy(P(i, 0, 0)).split(",")[1]}" x2="${xy(P(i, AX, 0)).split(",")[0]}" y2="${xy(P(i, AX, 0)).split(",")[1]}"/>`;
    g += `<line class="grid-line" x1="${xy(P(0, i, 0)).split(",")[0]}" y1="${xy(P(0, i, 0)).split(",")[1]}" x2="${xy(P(AX, i, 0)).split(",")[0]}" y2="${xy(P(AX, i, 0)).split(",")[1]}"/>`;
  }

  // axes + arrowheads + labels
  const ex = P(AX + .4, 0, 0), ey = P(0, AX + .4, 0), ez = P(0, 0, AX + .4);
  g += `<line class="axis-line" x1="${O[0]}" y1="${O[1]}" x2="${xy(ex).split(",")[0]}" y2="${xy(ex).split(",")[1]}"/>` + head(O, ex, "axis-line", 7);
  g += `<line class="axis-line" x1="${O[0]}" y1="${O[1]}" x2="${xy(ey).split(",")[0]}" y2="${xy(ey).split(",")[1]}"/>` + head(O, ey, "axis-line", 7);
  g += `<line class="axis-line" x1="${O[0]}" y1="${O[1]}" x2="${xy(ez).split(",")[0]}" y2="${xy(ez).split(",")[1]}"/>` + head(O, ez, "axis-line", 7);
  const lx = P(AX + 1, 0, 0), ly = P(0, AX + 1, 0), lz = P(0, 0, AX + 1);
  g += `<text class="axis-label" fill="var(--cx)" x="${lx[0]}" y="${lx[1] + 4}" text-anchor="middle">X</text>`;
  g += `<text class="axis-label" fill="var(--cy)" x="${ly[0]}" y="${ly[1] + 4}" text-anchor="middle">Y</text>`;
  g += `<text class="axis-label" fill="var(--cz)" x="${lz[0]}" y="${lz[1]}" text-anchor="middle">Z</text>`;

  // unit basis vectors (hats) at 1 on each axis
  const u1 = P(1, 0, 0), u2 = P(0, 1, 0), u3 = P(0, 0, 1);
  g += `<text class="unit-label" x="${u1[0]}" y="${u1[1] + 18}" text-anchor="middle">x̂</text>`;
  g += `<text class="unit-label" x="${u2[0] + 14}" y="${u2[1] + 5}" text-anchor="middle">ŷ</text>`;
  g += `<text class="unit-label" x="${u3[0] - 15}" y="${u3[1] + 4}" text-anchor="middle">ẑ</text>`;

  const tip = P(cx, cy, cz);
  const fx = P(cx, 0, 0), fy = P(0, cy, 0), fz = P(0, 0, cz);

  // dashed projector "light rays" from the tip down to each axis foot (the shadows)
  if (cx || cy || cz) {
    g += `<line class="proj" x1="${tip[0]}" y1="${tip[1]}" x2="${fx[0]}" y2="${fx[1]}"/>`;
    g += `<line class="proj" x1="${tip[0]}" y1="${tip[1]}" x2="${fy[0]}" y2="${fy[1]}"/>`;
    g += `<line class="proj" x1="${tip[0]}" y1="${tip[1]}" x2="${fz[0]}" y2="${fz[1]}"/>`;
  }

  // component segments (the shadows lying on the axes)
  if (cx) g += `<line class="comp x" x1="${O[0]}" y1="${O[1]}" x2="${fx[0]}" y2="${fx[1]}"/>`;
  if (cy) g += `<line class="comp y" x1="${O[0]}" y1="${O[1]}" x2="${fy[0]}" y2="${fy[1]}"/>`;
  if (cz) g += `<line class="comp z" x1="${O[0]}" y1="${O[1]}" x2="${fz[0]}" y2="${fz[1]}"/>`;
  if (cx) g += `<circle class="foot x" cx="${fx[0]}" cy="${fx[1]}" r="3.5"/>`;
  if (cy) g += `<circle class="foot y" cx="${fy[0]}" cy="${fy[1]}" r="3.5"/>`;
  if (cz) g += `<circle class="foot z" cx="${fz[0]}" cy="${fz[1]}" r="3.5"/>`;

  // the vector itself
  if (cx || cy || cz) {
    g += `<line class="vec" x1="${O[0]}" y1="${O[1]}" x2="${tip[0]}" y2="${tip[1]}"/>` + head(O, tip, "vec-head", 10);
    g += `<circle class="tip" cx="${tip[0]}" cy="${tip[1]}" r="4.5"/>`;
  } else {
    g += `<circle class="tip" cx="${O[0]}" cy="${O[1]}" r="4.5"/>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="an arrow in 3-D and its shadows on the X, Y and Z axes">${g}</svg>`;
}

function readoutHTML() {
  const rank = (cx || cy || cz) ? 1 : 1; // a coordinate vector is always rank 1 here
  const span = (v, c) => `<span class="${c}${v ? "" : " off"}">${v}</span>`;
  return `<div class="array"><span class="br">[ </span>${span(cx, "x")}<span class="br">, </span>${span(cy, "y")}<span class="br">, </span>${span(cz, "z")}<span class="br"> ]</span></div>
    <div class="meta">
      <div class="row"><span class="swatch x"></span>X shadow → first number <b>${cx}</b></div>
      <div class="row"><span class="swatch y"></span>Y shadow → second number <b>${cy}</b></div>
      <div class="row"><span class="swatch z"></span>Z shadow → third number <b>${cz}</b></div>
    </div>
    <span class="tag">rank <b>1</b> tensor · shape <b>(3,)</b> · <b>3</b> numbers stored</span>
    <div class="memrow">
      <div class="memlabel">stored flat in HBM →</div>
      <div class="cells"><span class="cell x">${cx}</span><span class="cell y">${cy}</span><span class="cell z">${cz}</span></div>
      <div class="memnote">The chip never holds an arrow — just this <b>flat row of numbers</b>.</div>
    </div>`;
}

let mounted = false;

/**
 * The controls are built once, so the one a keyboard user moves keeps focus; a change updates their
 * value labels and redraws the outputs in place (LMS-content#122, as #59 did for the sliders of five
 * other simulations).
 */
function mount() {
  $("controls").innerHTML =
    `<div class="sl x"><label for="sx">X <b id="sx-val">${cx}</b></label><input type="range" id="sx" min="0" max="${AX}" step="1" value="${cx}"></div>` +
    `<div class="sl y"><label for="sy">Y <b id="sy-val">${cy}</b></label><input type="range" id="sy" min="0" max="${AX}" step="1" value="${cy}"></div>` +
    `<div class="sl z"><label for="sz">Z <b id="sz-val">${cz}</b></label><input type="range" id="sz" min="0" max="${AX}" step="1" value="${cz}"></div>`;
  document.querySelectorAll(".sl input").forEach((el) => el.addEventListener("input", (e) => {
    const v = +e.target.value;
    if (e.target.id === "sx") cx = v; else if (e.target.id === "sy") cy = v; else cz = v;
    if (!observed) { observed = true; sim.checkpoint("observe-tensor"); }
    sim.event("vector", { cx, cy, cz });
    render();
  }));
  mounted = true;
}

function render() {
  if (!mounted) mount();
  $("sx-val").textContent = String(cx);
  $("sy-val").textContent = String(cy);
  $("sz-val").textContent = String(cz);

  $("scene").innerHTML = sceneSVG();
  $("readout").innerHTML = readoutHTML();

  const flat = cz === 0;
  $("note").innerHTML = flat
    ? `Right now the arrow lies <b>flat</b> on the X–Y floor — two non-zero shadows, so two numbers carry it (the third is just <b>0</b>). This is exactly Dan Fleisch's <b>[4, 3, 0]</b> arrow. Add some <span class="c3">Z</span> and you lift it off the floor — you've <b>added a dimension</b>, and now you need all three numbers.`
    : `The arrow points up off the floor, so all three shadows are non-zero — the array <b>[${cx}, ${cy}, ${cz}]</b> needs every number to place it. That list <b>is</b> the tensor: the chip never stores an arrow, only these components. (The <span class="c2">unit vectors</span> x̂ ŷ ẑ are just the agreed "1-step" ruler that makes the numbers mean a real direction.)`;
  reportSize();
}

const sim = createSim({
  onInit({ theme }) { applyTheme(theme); render(); },
});
new ResizeObserver(() => reportSize()).observe(document.body);
setTimeout(() => { if (!sim.isInitialized()) render(); }, 300);
