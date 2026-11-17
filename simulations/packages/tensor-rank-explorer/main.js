// createSim is a global from sim-sdk.js (classic script). Rank = how many dimensions a tensor has.
// We draw a toy tensor with N=3 per dimension as a cluster of isometric cubes: rank 0 = 1 block,
// rank 1 = 3, rank 2 = 9, rank 3 = 27 — each dimension MULTIPLIES the count. The right panel scales
// the same idea to a realistic model dimension (4096, bf16): 2 B → 8 KiB → 32 MiB → 128 GiB, where
// the rank-3 tensor blows past one accelerator's HBM. That multiplicative blow-up is the whole point.
// Deterministic, theme + reduced-motion aware, no CDNs.

const $ = (id) => document.getElementById(id);
const N = 3;              // toy size per dimension (gives 1, 3, 9, 27)
const MODEL = 4096;       // realistic model dimension for the memory bill
const BYTES = 2;          // bf16
const HBM_GB = 100;       // ~ one high-end accelerator's HBM (round, vendor-neutral)
let rank = 0, observed = false;

const NAMES = ["scalar", "vector", "matrix", "3-D tensor"];

// --- cabinet projection (matches vector-basis-explorer) ----------------------------------------
const U = 34, D = 22, ANG = 40 * Math.PI / 180;
const DX = D * Math.cos(ANG), DY = D * Math.sin(ANG);
const OX = 78, OY = 206, W = 320, H = 232;
const P = (x, y, z) => [OX + x * U + y * DX, OY - z * U - y * DY];
const xy = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 16)); }

function poly(pts, cls) { return `<polygon class="${cls}" points="${pts.map(xy).join(" ")}"/>`; }

function cube(x, y, z) {
  const top = [P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)];
  const front = [P(x, y, z), P(x + 1, y, z), P(x + 1, y, z + 1), P(x, y, z + 1)];
  const side = [P(x + 1, y, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x + 1, y, z + 1)];
  return poly(side, "face-side") + poly(top, "face-top") + poly(front, "face-front");
}

function blocksSVG() {
  // which cells exist at this rank (N along each active dimension, 1 along the rest)
  const nx = rank >= 1 ? N : 1;
  const ny = rank >= 2 ? N : 1;
  const nz = rank >= 3 ? N : 1;
  const cells = [];
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) cells.push([x, y, z]);
  // painter's order: far (large y) first, then bottom-up, then left-to-right
  cells.sort((a, b) => (b[1] - a[1]) || (a[2] - b[2]) || (a[0] - b[0]));
  const g = cells.map(([x, y, z]) => cube(x, y, z)).join("");
  // center the cluster's bounding box in the viewBox so every rank frames cleanly
  const corners = [];
  for (const X of [0, nx]) for (const Y of [0, ny]) for (const Z of [0, nz]) corners.push(P(X, Y, Z));
  const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
  const dx = W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = H / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${Math.pow(N, rank)} blocks for a rank-${rank} tensor"><g transform="translate(${dx.toFixed(1)},${dy.toFixed(1)})">${g}</g></svg>`;
}

function fmt(b) {
  const u = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return (i > 0 && b < 10 ? b.toFixed(1) : Math.round(b)) + " " + u[i];
}

function shapeStr() {
  if (rank === 0) return "( )";
  return "(" + Array(rank).fill(N).join(", ") + (rank === 1 ? "," : "") + ")";
}
function eqStr() {
  if (rank === 0) return "1";
  return Array(rank).fill(N).join(" × ") + " = " + Math.pow(N, rank);
}
function modelShape() {
  if (rank === 0) return "( )";
  return "(" + Array(rank).fill(MODEL).join(", ") + (rank === 1 ? "," : "") + ")";
}

function buildControls() {
  $("controls").innerHTML = [0, 1, 2, 3].map((r) =>
    `<button class="rbtn" data-r="${r}"><span class="rk">rank ${r}</span><span class="nm">${NAMES[r]}</span></button>`
  ).join("");
  document.querySelectorAll(".rbtn").forEach((b) => b.addEventListener("click", () => {
    rank = +b.dataset.r;
    if (!observed) { observed = true; sim.checkpoint("observe-footprint"); }
    sim.event("rank", { rank });
    render();
  }));
}

function render() {
  // The rank buttons are written once and only their state changes, so the button a keyboard user pressed stays
  // the same element and keeps focus (LMS-content#135).
  if (!document.querySelector(".rbtn")) buildControls();
  document.querySelectorAll(".rbtn").forEach((b) => {
    const on = +b.dataset.r === rank;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });

  $("blocktitle").textContent = `The shape, as blocks — ${NAMES[rank]}`;
  $("blocks").innerHTML = blocksSVG();

  const modelBytes = Math.pow(MODEL, rank) * BYTES;
  const over = modelBytes > HBM_GB * 1e9;
  $("readout").innerHTML = `
    <div class="count">a tiny example, ${N} per dimension</div>
    <div class="shape">${shapeStr()}</div>
    <div class="eq">${eqStr()} number${Math.pow(N, rank) === 1 ? "" : "s"}</div>
    <div class="divider"></div>
    <div class="scale-label">Now make each dimension realistic</div>
    <div class="scale-sub">model width <b>${MODEL}</b>, bf16 (2 bytes each) — shape ${modelShape()}</div>
    <div class="bytes ${over ? "over" : ""}">${fmt(modelBytes)}</div>
    <div class="fit ${over ? "over" : ""}">${over ? `✗ won't fit in one chip's ~${HBM_GB} GB HBM` : `✓ fits comfortably in one chip (~${HBM_GB} GB HBM)`}</div>`;

  const cnt = Math.pow(N, rank);
  const note = $("note");
  note.className = "note" + (over ? " over" : "");
  if (rank === 0)
    note.innerHTML = `A <b>rank-0</b> tensor is a single number — a <b>scalar</b>. No indices needed; it's just <b>one</b> value, like a learning rate, or <b>one grayscale pixel's brightness</b>.`;
  else if (rank === 1)
    note.innerHTML = `A <b>rank-1</b> tensor is a <b>vector</b> — one index, ${N} numbers in a row. Like a <b>row of pixels</b>, a 1-D sensor log, or the <b>[x, y, z]</b> from the last sim.`;
  else if (rank === 2)
    note.innerHTML = `A <b>rank-2</b> tensor is a <b>matrix</b> — two indices, ${N}×${N} = <b>${cnt}</b> numbers. Like a <b>grayscale image</b> (a grid of brightness values), or a routing table. At model scale it's already <b>32 MiB</b>.`;
  else
    note.innerHTML = `A <b>rank-3</b> tensor needs three indices — like a <b>color image</b> (height × width × 3 RGB channels). ${N}×${N}×${N} = <b>${cnt}</b> numbers in the toy, but <span class="hl over">128 GiB</span> at model scale. <b>One extra dimension</b> took the same data past a whole chip's HBM — that's why color/video tensors, activations, and the KV-cache devour memory, and why operators watch rank.`;

  reportSize();
}

const sim = createSim({
  onInit({ theme }) { applyTheme(theme); render(); },
});
new ResizeObserver(() => reportSize()).observe(document.body);
setTimeout(() => { if (!sim.isInitialized()) render(); }, 300);
