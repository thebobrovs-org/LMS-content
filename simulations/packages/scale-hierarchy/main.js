// createSim is a global from sim-sdk.js (classic script). An interactive 3D mesh
// of the TPU scale ladder: chip → host(tray) → cube → slice → pod → Multislice.
// Drag to rotate. Network coloring: copper ICI (intra-cube) · optical ICI (OCS,
// inter-cube) · DCN (cross-pod). Theme-aware, SDK-wired, reduced-motion aware, no CDNs.
const app = document.getElementById("app");

const LEVELS = [
  { id: "chip", name: "Chip", count: "1", sub: "the node", net: "N/A",
    detail: "One TPU chip has six ICI links (±X, ±Y, ±Z). It is the foundational node in the 3D torus.",
    layout: () => grid(1, 1, 1, 0), camDist: 10 },
  { id: "host", name: "Host (tray)", count: "4", sub: "1 VM · ~4 chips", net: "COPPER ICI",
    detail: "A host machine packages ~4 chips connected by physical <b>copper ICI</b> traces on the board. This is the unit you actually SSH into.",
    layout: () => grid(2, 2, 1, 0), camDist: 15 },
  { id: "cube", name: "Cube", count: "64", sub: "4×4×4", net: "COPPER ICI",
    detail: "A <b>4×4×4</b> grid of 64 chips, wired by <b>copper ICI</b> inside a single rack. The largest block before optical switches.",
    layout: () => grid(4, 4, 4, 0), camDist: 40 },
  { id: "slice", name: "Slice", count: "256", sub: "4 cubes · illustrative", net: "OPTICAL ICI",
    detail: "To scale beyond a rack, cubes are joined by <b>Optical Circuit Switches (OCS)</b>. This grows the torus and routes around failed chips.",
    layout: () => grid(8, 4, 8, 0), camDist: 70 },
  { id: "pod", name: "Pod", count: "up to 8,960", sub: "v5p (16×20×28) · illustrative", net: "OPTICAL ICI",
    detail: "A single huge 3D torus where every hop rides ultra-fast ICI (a v5p pod is <b>8,960 chips</b>). <b>The largest single-network domain.</b>",
    layout: () => grid(8, 8, 12, 0), camDist: 100 },
  { id: "multislice", name: "Multislice", count: "many pods", sub: "tens of thousands · illustrative", net: "DCN",
    detail: "Join multiple pods over the <b>Data-Center Network (DCN)</b> for trillion-parameter models. Cross-pod traffic is Ethernet — far slower than ICI.",
    layout: () => [...grid(6, 6, 6, -30), ...grid(6, 6, 6, 0), ...grid(6, 6, 6, 30)], camDist: 180 },
];

let i = 0, observed = false;
let particles = [], targetParticles = [], links = [], dcnLinks = [];
let yaw = -0.6, pitch = -0.3, currentCamDist = 10, targetCamDist = 10;
let isDragging = false, lastX = 0, lastY = 0, animating = false;
let canvas, ctx;
const REDUCE = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function grid(sx, sy, sz, offsetX) {
  const nodes = [], spacing = 3.5, cx = (sx - 1) / 2, cy = (sy - 1) / 2, cz = (sz - 1) / 2;
  for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++)
    nodes.push({ x: (x - cx + offsetX) * spacing, y: (y - cy) * spacing, z: (z - cz) * spacing, tx: x, ty: y, tz: z, podOffset: offsetX });
  return nodes;
}

function updateDataState() {
  const lvl = LEVELS[i];
  targetParticles = lvl.layout();
  targetCamDist = lvl.camDist;
  while (particles.length < targetParticles.length) {
    const t = targetParticles[particles.length];
    particles.push({ x: t.x, y: t.y, z: t.z, s: 0 });
  }
  links = []; dcnLinks = [];
  if (i > 0) {
    const nodes = targetParticles;
    for (let a = 0; a < nodes.length; a++) {
      const n1 = nodes[a];
      for (let b = a + 1; b < nodes.length; b++) {
        const n2 = nodes[b];
        if (lvl.id === "multislice" && n1.podOffset !== n2.podOffset) {
          if (n1.ty === 0 && n2.ty === 0 && ((a * 31 + b) % 25 === 0)) dcnLinks.push([a, b]);
          continue;
        }
        if (n1.podOffset === n2.podOffset) {
          const dx = Math.abs(n1.tx - n2.tx), dy = Math.abs(n1.ty - n2.ty), dz = Math.abs(n1.tz - n2.tz);
          if ((dx === 1 && dy === 0 && dz === 0) || (dx === 0 && dy === 1 && dz === 0) || (dx === 0 && dy === 0 && dz === 1)) {
            const optical = Math.floor(n1.tx / 4) !== Math.floor(n2.tx / 4) || Math.floor(n1.ty / 4) !== Math.floor(n2.ty / 4) || Math.floor(n1.tz / 4) !== Math.floor(n2.tz / 4);
            links.push({ i1: a, i2: b, type: optical ? "optical" : "copper" });
          }
        }
      }
    }
  }
  renderUI();
}

function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => { if (window.sim && sim.resize) sim.resize(document.body.scrollHeight + 8); }); }

function setLevel(n) {
  i = Math.max(0, Math.min(LEVELS.length - 1, n));
  if (i === LEVELS.length - 1 && !observed && window.sim) { observed = true; sim.checkpoint("observe-multislice"); }
  if (window.sim) sim.event("level", { level: LEVELS[i].id });
  updateDataState();
}

function renderUI() {
  const lvl = LEVELS[i];
  const isDCN = lvl.id === "multislice";
  const netClass = isDCN ? "net-dcn" : lvl.net === "OPTICAL ICI" ? "net-optical" : "net-copper";
  const steps = LEVELS.map((l, n) => `<button class="step-btn ${n === i ? "active" : ""} ${n < i ? "done" : ""}" data-i="${n}">${l.name}</button>${n < LEVELS.length - 1 ? '<span class="step-arrow">→</span>' : ""}`).join("");

  app.innerHTML = `
    <div class="steps-container">${steps}</div>
    <div class="stage">
      <canvas id="c"></canvas>
      <div class="stage-overlay">
        <div class="chip-count">${lvl.count} chips</div>
        <div class="chip-sub">${lvl.sub}</div>
        ${lvl.net !== "N/A" ? `<div class="network-badge ${netClass}">${lvl.net}</div>` : ""}
      </div>
      <div class="stage-legend">
        <div class="leg-item"><span class="leg-color" style="background:#2dd4bf"></span> Copper ICI (intra-cube)</div>
        <div class="leg-item"><span class="leg-color" style="background:#818cf8"></span> Optical ICI (inter-cube)</div>
        <div class="leg-item"><span class="leg-color" style="background:#fbbf24"></span> DCN (Ethernet)</div>
      </div>
      <div class="drag-hint">Drag to rotate</div>
    </div>
    <div class="readout-panel ${isDCN ? "is-dcn" : ""}">
      <div class="r-title">${lvl.name}</div>
      <div class="r-desc">${lvl.detail}</div>
      ${isDCN ? `<div class="r-dcn-warn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Needs MTU 8896 + VPC firewall rules for host rendezvous.</div>` : ""}
    </div>
    <div class="nav-row">
      <button class="btn" data-act="prev" ${i === 0 ? "disabled" : ""}>← Zoom in</button>
      <button class="btn primary" data-act="next" ${i === LEVELS.length - 1 ? "disabled" : ""}>Scale up →</button>
    </div>`;

  app.querySelectorAll(".step-btn").forEach((el) => el.addEventListener("click", () => setLevel(+el.getAttribute("data-i"))));
  app.querySelector('[data-act="prev"]').addEventListener("click", () => setLevel(i - 1));
  app.querySelector('[data-act="next"]').addEventListener("click", () => setLevel(i + 1));

  canvas = document.getElementById("c");
  ctx = canvas.getContext("2d");
  canvas.addEventListener("pointerdown", (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; nudge(); });
  window.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + (e.clientY - lastY) * 0.008));
    lastX = e.clientX; lastY = e.clientY;
    nudge();
  });
  window.addEventListener("pointerup", () => { isDragging = false; });
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

function project(x, y, z, w, h, camZ) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = x * cy + z * sy, z1 = z * cy - x * sy, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
  const fov = 800, distance = camZ + z2, scale = distance > 0 ? fov / distance : 0;
  return { sx: w / 2 + x1 * scale, sy: h / 2 + y1 * scale, depth: z2, scale };
}

/** Draw one frame. Returns whether anything is still moving, so the loop knows whether to continue. */
function animate() {
  if (!canvas || !ctx) return false;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  // Auto-rotation runs unless the learner prefers reduced motion, and it rests IDLE_MS
  // after the last interaction. A drag, or a transition that hasn't settled, also needs
  // more frames.
  const auto = !REDUCE && performance.now() < activeUntil;
  let moving = auto || isDragging;
  const camStep = (targetCamDist - currentCamDist) * 0.05;
  currentCamDist += camStep;
  if (Math.abs(camStep) > 0.001) moving = true;
  if (auto && !isDragging) yaw += 0.0009;

  const nodesP = [];
  const isDCN = LEVELS[i].id === "multislice";
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
    if (p.s > 0.01) nodesP.push({ k, proj: project(p.x, p.y, p.z, w, h, currentCamDist), s: p.s });
  }
  const projOf = {}; nodesP.forEach((n) => (projOf[n.k] = n.proj));

  if (isDCN) {
    ctx.lineWidth = Math.max(2, 70 / currentCamDist); ctx.strokeStyle = "rgba(251,191,36,0.85)"; ctx.beginPath();
    for (const [a, b] of dcnLinks) if (projOf[a] && projOf[b]) {
      const p1 = projOf[a], p2 = projOf[b]; ctx.moveTo(p1.sx, p1.sy);
      ctx.quadraticCurveTo((p1.sx + p2.sx) / 2, (p1.sy + p2.sy) / 2 - 120, p2.sx, p2.sy);
    }
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(1.5, 35 / currentCamDist); ctx.strokeStyle = "rgba(129,140,248,0.85)"; ctx.beginPath();
  for (const l of links) if (l.type === "optical" && projOf[l.i1] && projOf[l.i2]) { ctx.moveTo(projOf[l.i1].sx, projOf[l.i1].sy); ctx.lineTo(projOf[l.i2].sx, projOf[l.i2].sy); }
  ctx.stroke();
  ctx.lineWidth = Math.max(1, 20 / currentCamDist); ctx.strokeStyle = "rgba(45,212,191,0.6)"; ctx.beginPath();
  for (const l of links) if (l.type === "copper" && projOf[l.i1] && projOf[l.i2]) { ctx.moveTo(projOf[l.i1].sx, projOf[l.i1].sy); ctx.lineTo(projOf[l.i2].sx, projOf[l.i2].sy); }
  ctx.stroke();

  nodesP.sort((a, b) => b.proj.depth - a.proj.depth);
  for (const n of nodesP) {
    const r = Math.max(0.5, n.proj.scale * 0.4 * n.s), p = n.proj;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    if (isDCN) ctx.fillStyle = "rgba(59,130,246,0.35)";
    else { ctx.fillStyle = "rgba(59,130,246,1)"; ctx.shadowColor = "rgba(59,130,246,0.5)"; ctx.shadowBlur = r * 2; }
    ctx.fill(); ctx.shadowBlur = 0;
  }
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
