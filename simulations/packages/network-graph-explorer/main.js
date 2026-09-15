// createSim is a global from sim-sdk.js (classic script). A cluster interconnect as a graph: an R×C
// grid of nodes (devices) + edges (links), optional wrap-around (mesh ↔ torus). We compute the real
// graph metrics — network diameter (worst-case shortest path, via BFS) and bisection (links cut to
// split it in half) — and highlight the diameter path and the cut. Wrap halves diameter; a squarer
// grid raises bisection. Vendor-neutral. Deterministic (BFS + structured cut, no Math.random),
// theme + reduced-motion aware, no CDNs.

const $ = (id) => document.getElementById(id);
let R = 4, C = 8, wrap = false, observed = false;

const sx = 46, sy = 46, padX = 40, padY = 40;
const applyTheme = (t) => { if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 16)); }

const ekey = (a, b) => Math.min(a, b) + "-" + Math.max(a, b);
const npos = (i) => [padX + (i % C) * sx, padY + Math.floor(i / C) * sy];

function buildGraph() {
  const N = R * C;
  const adj = Array.from({ length: N }, () => []);
  const edges = [];
  const addE = (a, b, type) => { adj[a].push(b); adj[b].push(a); edges.push({ a, b, type }); };
  const idx = (r, c) => r * C + c;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (c + 1 < C) addE(idx(r, c), idx(r, c + 1), "h");
    if (r + 1 < R) addE(idx(r, c), idx(r + 1, c), "v");
  }
  if (wrap) {
    if (C >= 3) for (let r = 0; r < R; r++) addE(idx(r, C - 1), idx(r, 0), "wh");
    if (R >= 3) for (let c = 0; c < C; c++) addE(idx(R - 1, c), idx(0, c), "wv");
  }
  return { N, adj, edges };
}

function bfs(adj, s, N) {
  const dist = new Array(N).fill(-1), par = new Array(N).fill(-1);
  dist[s] = 0; const q = [s]; let h = 0;
  while (h < q.length) { const u = q[h++]; for (const v of adj[u]) if (dist[v] < 0) { dist[v] = dist[u] + 1; par[v] = u; q.push(v); } }
  return { dist, par };
}

function metrics(g) {
  let dia = 0, src = 0, dst = 0, sum = 0;
  for (let s = 0; s < g.N; s++) {
    const { dist } = bfs(g.adj, s, g.N);
    for (let t = 0; t < g.N; t++) { sum += dist[t]; if (dist[t] > dia) { dia = dist[t]; src = s; dst = t; } }
  }
  const avg = g.N > 1 ? sum / (g.N * (g.N - 1)) : 0;
  // one worst-case shortest path (for highlight)
  const { par } = bfs(g.adj, src, g.N);
  const diaSet = new Set();
  let cur = dst; while (par[cur] >= 0) { diaSet.add(ekey(cur, par[cur])); cur = par[cur]; }
  // bisection: cut the longer axis at its middle (+ wrap seam if torus)
  const cut = [];
  if (C >= R) {
    const k = Math.floor(C / 2);
    for (const e of g.edges) {
      const ca = e.a % C, cb = e.b % C;
      if (e.type === "h" && Math.min(ca, cb) === k - 1 && Math.max(ca, cb) === k) cut.push(e);
      if (wrap && e.type === "wh") cut.push(e);
    }
  } else {
    const k = Math.floor(R / 2);
    for (const e of g.edges) {
      const ra = Math.floor(e.a / C), rb = Math.floor(e.b / C);
      if (e.type === "v" && Math.min(ra, rb) === k - 1 && Math.max(ra, rb) === k) cut.push(e);
      if (wrap && e.type === "wv") cut.push(e);
    }
  }
  const cutSet = new Set(cut.map((e) => ekey(e.a, e.b)));
  return { dia, avg, bisection: cut.length, diaSet, cutSet, src, dst };
}

function edgePath(e) {
  const [x1, y1] = npos(e.a), [x2, y2] = npos(e.b);
  if (e.type === "wh") { const mx = (x1 + x2) / 2; return `M ${x1} ${y1} Q ${mx} ${y1 - 42} ${x2} ${y2}`; }
  if (e.type === "wv") { const my = (y1 + y2) / 2; return `M ${x1} ${y1} Q ${x1 - 38} ${my} ${x2} ${y2}`; }
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

function graphSVG(g, m) {
  const W = padX * 2 + (C - 1) * sx, H = padY * 2 + (R - 1) * sy;
  let e = "";
  for (const ed of g.edges) {
    const key = ekey(ed.a, ed.b);
    const cls = "edge" + (ed.type[0] === "w" ? " wrap" : "") + (m.cutSet.has(key) ? " cut" : m.diaSet.has(key) ? " dia" : "");
    e += `<path class="${cls}" d="${edgePath(ed)}"/>`;
  }
  let n = "";
  for (let i = 0; i < g.N; i++) { const [x, y] = npos(i); const end = (i === m.src || i === m.dst); n += `<circle class="node${end ? " end" : ""}" cx="${x}" cy="${y}" r="${end ? 7 : 5.5}"/>`; }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${R} by ${C} interconnect graph; diameter ${m.dia} hops, bisection ${m.bisection} links">${e}${n}</svg>`;
}

let mounted = false;

/**
 * The controls are built once, so the one a keyboard user moves keeps focus; a change updates their
 * value labels and redraws the outputs in place (LMS-content#122, as #59 did for the sliders of five
 * other simulations).
 */
function mount() {
  $("controls").innerHTML =
    `<div class="sl"><label for="c-r">Rows <b id="r-val">${R}</b></label><input type="range" id="c-r" min="1" max="8" step="1" value="${R}"></div>` +
    `<div class="sl"><label for="c-c">Columns <b id="c-val">${C}</b></label><input type="range" id="c-c" min="2" max="12" step="1" value="${C}"></div>` +
    `<label class="toggle"><input type="checkbox" id="c-w"><span>Wrap-around (mesh → torus)</span></label>`;
  $("c-r").addEventListener("input", (e) => { R = +e.target.value; sim.event("shape", { R, C }); render(); });
  $("c-c").addEventListener("input", (e) => { C = +e.target.value; sim.event("shape", { R, C }); render(); });
  $("c-w").addEventListener("change", (e) => { wrap = e.target.checked; if (wrap && !observed) { observed = true; sim.checkpoint("observe-topology"); } render(); });
  mounted = true;
}

function render() {
  if (!mounted) mount();
  $("r-val").textContent = String(R);
  $("c-val").textContent = String(C);
  $("c-w").checked = wrap;

  const g = buildGraph();
  const m = metrics(g);

  $("cards").innerHTML =
    `<div class="card"><div class="k">Nodes</div><div class="v">${g.N}</div></div>` +
    `<div class="card"><div class="k">Diameter (hops)</div><div class="v dia">${m.dia}</div></div>` +
    `<div class="card"><div class="k">Avg hops</div><div class="v">${m.avg.toFixed(1)}</div></div>` +
    `<div class="card"><div class="k">Bisection (links)</div><div class="v bis">${m.bisection}</div></div>`;

  $("graph").innerHTML = graphSVG(g, m) +
    `<div class="legend"><div class="it"><span class="sw edge"></span>link</div><div class="it"><span class="sw dia"></span>diameter path (worst-case hops)</div><div class="it"><span class="sw cut"></span>bisection cut</div></div>`;

  $("note").innerHTML = `This shape: <b>${R}×${C}</b>${wrap ? " torus (wrapped)" : " mesh"} — <span class="dia">diameter ${m.dia} hops</span> (worst-case latency, the amber path) and <span class="cut">bisection ${m.bisection} links</span> (the red cut to split it in half — your cross-section throughput). The all-reduce from the last lesson <b>rides this graph</b>, so these two numbers are its speed limit. Flip wrap-around to halve the diameter; square up the grid to raise the bisection — same nodes, faster network.`;
  reportSize();
}

const sim = createSim({ onInit({ theme }) { applyTheme(theme); render(); } });
new ResizeObserver(() => reportSize()).observe(document.body);
setTimeout(() => { if (!sim.isInitialized()) render(); }, 300);
