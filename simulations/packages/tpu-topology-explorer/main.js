// createSim is a global from sim-sdk.js (classic script). Compares the network
// diameter (worst-case hops) of three TPU topologies — 2D torus, 3D torus, Boardfly —
// as a draggable 3D mesh with the worst-case path drawn as a glowing laser.
// Deterministic, theme-aware, SDK-wired, reduced-motion aware, no CDNs.
const app = document.getElementById("app");

const TOPOLOGIES = [
  { id: "2d", name: "2D Torus", chips: "1,024 chips (32×32)", hops: 32, maxHops: 32, gens: "v5e · v6e",
    desc: "A flat grid whose edges wrap around to the opposite side.",
    why: "Cheapest to wire. Good for smaller inference pods and highly parallel data workloads.",
    layout: gen2D },
  { id: "3d", name: "3D Torus", chips: "1,024 chips (8×8×16)", hops: 16, maxHops: 32, gens: "v4 · v5p · 8t",
    desc: "A multi-layer 3D grid with wrap-around links on all three axes (±X, ±Y, ±Z).",
    why: "Halves the diameter vs a 2D torus at the same chip count — keeps massive training collectives fast.",
    layout: gen3D },
  { id: "boardfly", name: "Boardfly", chips: "1,024 chips (optical)", hops: 7, maxHops: 32, gens: "TPU 8i",
    desc: "A hierarchical optical network that abandons the torus: dense local boards connect to central optical spines.",
    why: "Cuts worst-case diameter ~56% <b>vs the 3D torus</b> (7 vs 16 hops) — crucial for the all-to-all routing of MoE inference.",
    layout: genBoardfly },
];

let i = 1; // start on 3D torus
let particles = [], targetParticles = [], baseLinks = [], pathLinks = [], opticalSpines = [];
const START_YAW = -0.5, START_PITCH = -0.4;
let yaw = START_YAW, pitch = START_PITCH, currentCamDist = 60, targetCamDist = 60;
let isDragging = false, lastX = 0, lastY = 0, observed = false, pulseTime = 0, animating = false;
let canvas, ctx;
const REDUCE = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function gen2D() {
  const nodes = [], sx = 16, sy = 16, sp = 4.5, cx = (sx - 1) / 2, cy = (sy - 1) / 2;
  for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) nodes.push({ x: (x - cx) * sp, y: 0, z: (y - cy) * sp, tx: x, ty: 0, tz: y });
  baseLinks = []; pathLinks = []; opticalSpines = [];
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
    const dx = Math.abs(nodes[a].tx - nodes[b].tx), dz = Math.abs(nodes[a].tz - nodes[b].tz);
    if ((dx === 1 && dz === 0) || (dx === 0 && dz === 1) || (dx === sx - 1 && dz === 0) || (dx === 0 && dz === sy - 1)) baseLinks.push([a, b]);
  }
  let curr = 0, tx = 0, tz = 0;
  for (let step = 0; step < 16; step++) {
    const ntx = step % 2 === 0 ? tx + 1 : tx, ntz = step % 2 === 0 ? tz : tz + 1;
    const ni = nodes.findIndex((n) => n.tx === ntx && n.tz === ntz);
    if (ni !== -1) { pathLinks.push([curr, ni]); curr = ni; tx = ntx; tz = ntz; }
  }
  return { nodes, dist: 80 };
}

function gen3D() {
  const nodes = [], sx = 8, sy = 4, sz = 8, sp = 6, cx = (sx - 1) / 2, cy = (sy - 1) / 2, cz = (sz - 1) / 2;
  for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) nodes.push({ x: (x - cx) * sp, y: (y - cy) * sp, z: (z - cz) * sp, tx: x, ty: y, tz: z });
  baseLinks = []; pathLinks = []; opticalSpines = [];
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
    const dx = Math.abs(nodes[a].tx - nodes[b].tx), dy = Math.abs(nodes[a].ty - nodes[b].ty), dz = Math.abs(nodes[a].tz - nodes[b].tz);
    if ((dx === 1 && dy === 0 && dz === 0) || (dx === 0 && dy === 1 && dz === 0) || (dx === 0 && dy === 0 && dz === 1) ||
        (dx === sx - 1 && dy === 0 && dz === 0) || (dx === 0 && dy === sy - 1 && dz === 0) || (dx === 0 && dy === 0 && dz === sz - 1)) baseLinks.push([a, b]);
  }
  let curr = nodes.findIndex((n) => n.tx === 0 && n.ty === 0 && n.tz === 0), tx = 0, ty = 0, tz = 0;
  for (let step = 0; step < 8; step++) {
    let ntx = tx, nty = ty, ntz = tz;
    if (step < 3) ntx++; else if (step < 5) nty++; else ntz++;
    const ni = nodes.findIndex((n) => n.tx === ntx && n.ty === nty && n.tz === ntz);
    if (ni !== -1) { pathLinks.push([curr, ni]); curr = ni; tx = ntx; ty = nty; tz = ntz; }
  }
  return { nodes, dist: 70 };
}

function genBoardfly() {
  const nodes = [], clusters = 4, R = 25, sp = 3.5;
  baseLinks = []; pathLinks = [];
  opticalSpines = [{ x: 0, y: -25, z: -10 }, { x: 0, y: -25, z: 10 }];
  for (let c = 0; c < clusters; c++) {
    const angle = (c / clusters) * Math.PI * 2, ccx = Math.cos(angle) * R, ccz = Math.sin(angle) * R, start = nodes.length, sx = 8, sz = 8;
    for (let x = 0; x < sx; x++) for (let z = 0; z < sz; z++) {
      const idx = nodes.length;
      nodes.push({ x: ccx + (x - 3.5) * sp, y: 0, z: ccz + (z - 3.5) * sp, cIdx: c, lx: x, lz: z });
      // deterministic: roughly 1 chip per board edge links up to a spine
      if ((x + z) % 6 === 0) nodes[idx].spineLink = c % 2;
    }
    // deterministic dense local board links (nearest neighbours)
    for (let a = start; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      const dx = Math.abs(nodes[a].lx - nodes[b].lx), dz = Math.abs(nodes[a].lz - nodes[b].lz);
      if ((dx === 1 && dz === 0) || (dx === 0 && dz === 1)) baseLinks.push([a, b]);
    }
  }
  // worst-case path: chip → spine → spine → chip (hierarchical, ~7 hops)
  const c0Start = nodes.findIndex((n) => n.cIdx === 0);
  const c0Exit = nodes.findIndex((n) => n.cIdx === 0 && n.spineLink !== undefined);
  const c2Entry = nodes.findIndex((n) => n.cIdx === 2 && n.spineLink !== undefined);
  const c2End = nodes.findIndex((n, idx) => n.cIdx === 2 && idx !== c2Entry);
  if (c0Exit !== -1 && c2Entry !== -1) {
    pathLinks.push([c0Start, c0Exit]);
    pathLinks.push({ fromNode: c0Exit, toSpine: nodes[c0Exit].spineLink });
    pathLinks.push({ fromSpine: nodes[c0Exit].spineLink, toSpine: nodes[c2Entry].spineLink });
    pathLinks.push({ fromSpine: nodes[c2Entry].spineLink, toNode: c2Entry });
    pathLinks.push([c2Entry, c2End]);
  }
  return { nodes, dist: 95 };
}

function updateDataState() {
  const data = TOPOLOGIES[i].layout();
  targetParticles = data.nodes;
  targetCamDist = data.dist;
  while (particles.length < targetParticles.length) {
    const t = targetParticles[particles.length];
    particles.push({ x: t.x, y: t.y, z: t.z, s: 0 });
  }
  renderUI();
}
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => { if (window.sim && sim.resize) sim.resize(document.body.scrollHeight + 8); }); }

function setTab(n) {
  i = n;
  if (i === 2 && !observed && window.sim) { observed = true; sim.checkpoint("observe-topology"); }
  if (window.sim) sim.event("topology", { topology: TOPOLOGIES[i].id });
  updateDataState();
}

let mounted = false;

/**
 * The tabs, the canvas and the panels' frames are built once, so the tab pressed keeps focus and
 * the canvas keeps its context; a tab change updates them in place (LMS-content#100). The canvas
 * is focusable: the arrow keys rotate the view as a drag does, and Home resets it.
 */
function mountUI() {
  const tabs = TOPOLOGIES.map((x, n) => `<button type="button" class="tab" data-i="${n}" aria-pressed="false">${x.name}</button>`).join("");
  app.innerHTML = `
    <div class="tabs" role="group" aria-label="Topology">${tabs}</div>
    <div class="layout-grid">
      <div class="stage-container">
        <div class="stage">
          <canvas id="c" tabindex="0" role="img"></canvas>
          <div class="legend">
            <div class="leg-item"><div class="dot" style="background:rgba(59,130,246,0.6)"></div> Mesh</div>
            <div class="leg-item"><div class="dot" style="background:#b91c1c;box-shadow:0 0 10px #b91c1c"></div> Worst-case path</div>
          </div>
          <div class="drag-hint">Drag, or use the arrow keys, to rotate</div>
        </div>
      </div>
      <div class="sidebar">
        <div class="readout-panel" id="readout" aria-live="polite"></div>
        <div class="chart" id="chart"></div>
      </div>
    </div>`;

  app.querySelectorAll(".tab").forEach((el) => el.addEventListener("click", () => setTab(+el.getAttribute("data-i"))));
  canvas = document.getElementById("c");
  ctx = canvas.getContext("2d");
  canvas.addEventListener("pointerdown", (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; nudge(); });
  canvas.addEventListener("keydown", (e) => {
    const step = 0.12;
    if (e.key === "ArrowLeft") yaw -= step;
    else if (e.key === "ArrowRight") yaw += step;
    else if (e.key === "ArrowUp") pitch = Math.max(-Math.PI / 2, pitch - step);
    else if (e.key === "ArrowDown") pitch = Math.min(Math.PI / 2, pitch + step);
    else if (e.key === "Home") { yaw = START_YAW; pitch = START_PITCH; }
    else return;
    e.preventDefault();
    nudge();
  });
  mounted = true;
}

function renderUI() {
  if (!mounted) mountUI();
  const t = TOPOLOGIES[i];
  app.querySelectorAll(".tab").forEach((el) => {
    const on = +el.getAttribute("data-i") === i;
    el.classList.toggle("active", on);
    el.setAttribute("aria-pressed", String(on));
  });
  const bars = TOPOLOGIES.map((x, n) => `<div class="bar-wrap ${n === i ? "active" : ""}"><div class="bar-val">${x.hops}</div><div class="bar" style="height:${(x.hops / x.maxHops) * 100}%"></div><div class="bar-label">${x.name.replace(" Torus", "")}</div></div>`).join("");
  canvas.setAttribute("aria-label", `3D view of the ${t.name} mesh, ${t.hops} hops across. Arrow keys rotate; Home resets the view.`);
  document.getElementById("readout").innerHTML = `
          <div class="r-header"><div class="r-title">${t.name}</div><div class="r-badge">${t.gens}</div></div>
          <div class="r-stat">Shape: <b>${t.chips}</b><br/>Network diameter: <span class="hop-count">${t.hops} hops</span><br/><span class="r-illus">mesh illustrative (~256 nodes shown)</span></div>
          <div class="r-desc">${t.desc}</div>
          <div class="r-why"><b>Why it matters:</b> ${t.why}</div>`;
  document.getElementById("chart").innerHTML = `<div class="chart-axis">Max hops ↓</div>${bars}`;
  resizeCanvas();
  reportSize();
  nudge(); // a new view: draw it, and restart the idle timer
}

function resizeCanvas() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", () => { resizeCanvas(); nudge(); }); // resizing clears the canvas

// Window-level drag listeners are registered once, here: renderUI() runs on every tab
// change, and listeners added there stacked up, so every pointer move ran every copy.
window.addEventListener("pointermove", (e) => {
  if (!isDragging) return;
  yaw += (e.clientX - lastX) * 0.008;
  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + (e.clientY - lastY) * 0.008));
  lastX = e.clientX; lastY = e.clientY;
  nudge();
});
// A drag also ends when the gesture is cancelled (a touch turning into a scroll) or the
// window loses focus mid-drag. Otherwise isDragging would keep the loop drawing forever.
for (const type of ["pointerup", "pointercancel", "blur"]) window.addEventListener(type, () => { isDragging = false; });

function project(x, y, z, w, h, camZ) {
  const cyaw = Math.cos(yaw), syaw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = x * cyaw + z * syaw, z1 = z * cyaw - x * syaw, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
  const fov = 800, distance = camZ + z2, scale = distance > 0 ? fov / distance : 0;
  return { sx: w / 2 + x1 * scale, sy: h / 2 + y1 * scale, depth: z2, scale };
}

/** Draw one frame. Returns whether anything is still moving, so the loop knows whether to continue. */
function animate() {
  if (!canvas || !ctx) return false;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  // Auto-rotation and the pulse run unless the learner prefers reduced motion, and they
  // rest IDLE_MS after the last interaction. A drag, or a transition that hasn't
  // settled, also needs more frames.
  const auto = !REDUCE && performance.now() < activeUntil;
  let moving = auto || isDragging;
  const camStep = (targetCamDist - currentCamDist) * 0.05;
  currentCamDist += camStep;
  if (Math.abs(camStep) > 0.001) moving = true;
  if (auto && !isDragging) yaw += 0.0015;
  pulseTime = REDUCE ? 1.6 : auto ? pulseTime + 0.05 : pulseTime;

  // project each live particle, keyed by particle index (robust to filtering)
  const projOf = {}, drawList = [];
  for (let k = 0; k < particles.length; k++) {
    const p = particles[k];
    if (k < targetParticles.length) {
      const t = targetParticles[k];
      p.x += (t.x - p.x) * 0.1; p.y += (t.y - p.y) * 0.1; p.z += (t.z - p.z) * 0.1; p.s += (1 - p.s) * 0.1;
      if (Math.abs(t.x - p.x) + Math.abs(t.y - p.y) + Math.abs(t.z - p.z) + (1 - p.s) > 0.01) moving = true;
    } else {
      p.s += (0 - p.s) * 0.2;
      if (p.s > 0.01) moving = true;
    }
    if (p.s > 0.01) { const pr = project(p.x, p.y, p.z, w, h, currentCamDist); projOf[k] = pr; drawList.push({ i: k, proj: pr, s: p.s }); }
  }
  const spineP = opticalSpines.map((s) => project(s.x, s.y, s.z, w, h, currentCamDist));

  // base mesh links
  ctx.lineWidth = Math.max(0.3, 10 / currentCamDist); ctx.strokeStyle = "rgba(59,130,246,0.22)"; ctx.beginPath();
  for (const [a, b] of baseLinks) if (projOf[a] && projOf[b]) { ctx.moveTo(projOf[a].sx, projOf[a].sy); ctx.lineTo(projOf[b].sx, projOf[b].sy); }
  ctx.stroke();

  // spine connectors (Boardfly)
  if (spineP.length) {
    ctx.strokeStyle = "rgba(129,140,248,0.18)"; ctx.beginPath();
    for (let k = 0; k < targetParticles.length; k++) {
      const n = targetParticles[k];
      if (n && n.spineLink !== undefined && projOf[k] && spineP[n.spineLink]) { ctx.moveTo(projOf[k].sx, projOf[k].sy); ctx.lineTo(spineP[n.spineLink].sx, spineP[n.spineLink].sy); }
    }
    ctx.stroke();
  }

  // worst-case path laser
  const pulse = (Math.sin(pulseTime) + 1) / 2;
  ctx.lineWidth = Math.max(2, 60 / currentCamDist); ctx.strokeStyle = `rgba(220,38,38,${0.5 + pulse * 0.5})`;
  ctx.shadowColor = "rgba(220,38,38,0.8)"; ctx.shadowBlur = 15; ctx.beginPath();
  for (const link of pathLinks) {
    let p1, p2;
    if (Array.isArray(link)) { p1 = projOf[link[0]]; p2 = projOf[link[1]]; }
    else {
      p1 = link.fromNode !== undefined ? projOf[link.fromNode] : spineP[link.fromSpine];
      p2 = link.toNode !== undefined ? projOf[link.toNode] : spineP[link.toSpine];
    }
    if (p1 && p2) { ctx.moveTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy); }
  }
  ctx.stroke(); ctx.shadowBlur = 0;

  // nodes (path nodes glow red)
  const active = new Set();
  pathLinks.forEach((l) => { if (Array.isArray(l)) { active.add(l[0]); active.add(l[1]); } else { if (l.fromNode !== undefined) active.add(l.fromNode); if (l.toNode !== undefined) active.add(l.toNode); } });
  drawList.sort((a, b) => b.proj.depth - a.proj.depth);
  for (const node of drawList) {
    const r = Math.max(1, node.proj.scale * 1.5 * node.s), p = node.proj;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    if (active.has(node.i)) { ctx.fillStyle = "rgba(220,38,38,1)"; ctx.shadowColor = "rgba(220,38,38,0.8)"; ctx.shadowBlur = r * 3; }
    else { ctx.fillStyle = "rgba(59,130,246,0.5)"; ctx.shadowBlur = 0; }
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  for (const sp of spineP) { ctx.fillStyle = "#fff"; ctx.fillRect(sp.sx - 4, sp.sy - 4, 8, 8); }

  particles = particles.filter((p) => p.s > 0.01 || targetParticles.includes(p));
  return moving;
}

/**
 * Runs `frame` on requestAnimationFrame only while the sim is visible (its tab shown and
 * `el` on screen) and `frame` returns true, meaning something is still moving. `wake()`
 * restarts it after an interaction or a state change, so an idle sim costs no CPU (#58).
 */
function createLoop(frame, el) {
  let raf = 0, onScreen = true;
  const visible = () => onScreen && document.visibilityState !== "hidden";
  const tick = () => { raf = 0; if (visible() && frame()) raf = requestAnimationFrame(tick); };
  const wake = () => { if (!raf && visible()) raf = requestAnimationFrame(tick); };
  document.addEventListener("visibilitychange", wake);
  if (el && typeof IntersectionObserver === "function") {
    new IntersectionObserver((entries) => { onScreen = entries[entries.length - 1].isIntersecting; wake(); }).observe(el);
  }
  return { wake };
}
const loop = createLoop(animate, app);

// Auto-motion rests IDLE_MS after the last interaction, so a page left open costs no
// CPU even while the sim is on screen. Every interaction calls nudge().
const IDLE_MS = 10000;
let activeUntil = 0;
function nudge() { activeUntil = performance.now() + IDLE_MS; loop.wake(); }

function start() { if (animating) return; animating = true; updateDataState(); }

window.sim = typeof createSim !== "undefined" ? createSim({ onInit({ theme }) { applyTheme(theme); start(); } }) : null;
setTimeout(() => { if ((!window.sim || !sim.isInitialized()) && !document.getElementById("c")) start(); }, 300);
