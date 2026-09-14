// createSim is a global from sim-sdk.js (classic script). Dual-pane OCS explorer:
// left, the logical topology software sees; right, the Palomar MEMS mirror matrix
// photons see — the same pulse drawn in both. Five operations (ring, slicing,
// cross-rack, spare-cube repair, shuffle) show that tilting mirrors IS rewiring
// the pod. Adapted from a learner-provided artifact: gamification stripped
// (missions/XP → the topic's quiz), deterministic shuffle, no CDNs, listeners.
const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");
const reducedMotion =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CRC = window.CanvasRenderingContext2D;
if (CRC && !CRC.prototype.roundRect) {
  CRC.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); return this;
  };
}

const N = 8;
const SANS = "ui-sans-serif, system-ui, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
let currentMode = "ring";
const topoOffset = { x: 50, y: 110 };
const ocsOffset = { x: 625, y: 130 };
const ocsSpacing = 45;
const BASE = "#4cc9f0", PHOTON = "#ffc24b";

const cubes = [];
for (let i = 0; i < N; i++) {
  const isA = i < 4;
  cubes.push({
    id: i, status: "active", color: BASE,
    tx: isA ? topoOffset.x + 95 : topoOffset.x + 315,
    ty: topoOffset.y + 70 + (i % 4) * 105,
    row: isA ? "A" : "B",
  });
}

let routes = [1, 2, 3, 4, 5, 6, 7, 0];
const mirrors = [];
for (let t = 0; t < N; t++) { const r = []; for (let x = 0; x < N; x++) r.push({ angle: 0, targetAngle: 0 }); mirrors.push(r); }
let pulses = [];
let changedMirrors = {};
let failTimers = [];
let observed = false;

// Deterministic "shuffle": cycle through fixed derangements (no Math.random).
const SHUFFLES = [
  [3, 0, 1, 2, 7, 4, 5, 6],
  [5, 4, 7, 6, 1, 0, 3, 2],
  [2, 3, 0, 1, 6, 7, 4, 5],
  [7, 6, 5, 4, 3, 2, 1, 0],
  [4, 5, 6, 7, 0, 1, 2, 3],
  [6, 7, 4, 5, 2, 3, 0, 1],
];
let shuffleIdx = 0;

const T = { state: "stable", eventActive: false, eventStart: 0, moved: 0, events: 0, downTotal: 0, hold: false };
const $ = (id) => document.getElementById(id);

function setBadge(mode, text) {
  const b = $("linkBadge"); b.className = ""; if (mode) b.classList.add(mode);
  $("linkText").textContent = text;
}

function updateMirrors() {
  let diff = 0; const now = performance.now();
  for (let tx = 0; tx < N; tx++) for (let rx = 0; rx < N; rx++) {
    const active = routes[tx] === rx && cubes[tx].status !== "failed" && cubes[rx].status !== "failed";
    const target = active ? -Math.PI / 4 : 0;
    if (mirrors[tx][rx].targetAngle !== target) { diff++; changedMirrors[tx + "-" + rx] = now; }
    mirrors[tx][rx].targetAngle = target;
  }
  if (diff > 0) {
    if (!T.eventActive) { T.eventActive = true; T.eventStart = now; T.moved = 0; T.events++; }
    T.moved += diff;
    if (!T.hold) setBadge("reconf", "RECONFIGURING");
    $("tMirrors").textContent = T.moved;
    $("tEvents").textContent = T.events;
  }
}

function circuitsActive() {
  let c = 0;
  for (let tx = 0; tx < N; tx++) {
    const rx = routes[tx];
    if (rx !== null && cubes[tx].status !== "failed" && cubes[rx].status !== "failed") c++;
  }
  return c;
}

function getBezierCurve(a, b) {
  let sx = a.tx + 27, sy = a.ty, ex = b.tx - 27, ey = b.ty;
  let cp1x = sx + 60, cp2x = ex - 60;
  if (a.row === b.row) {
    if (b.id < a.id) { sx = a.tx - 27; ex = b.tx - 27; cp1x = sx - 85; cp2x = ex - 85; }
  } else if (a.row === "B" && b.row === "A") {
    sx = a.tx - 27; ex = b.tx + 27; cp1x = sx - 85; cp2x = ex + 85;
  }
  return { sx, sy, cp1x, cp1y: sy, cp2x, cp2y: ey, ex, ey };
}
function bezXY(t, c) {
  const u = 1 - t;
  return {
    x: u * u * u * c.sx + 3 * t * u * u * c.cp1x + 3 * t * t * u * c.cp2x + t * t * t * c.ex,
    y: u * u * u * c.sy + 3 * t * u * u * c.cp1y + 3 * t * t * u * c.cp2y + t * t * t * c.ey,
  };
}

class Pulse {
  constructor(tx, rx) {
    this.progress = 0;
    this.speed = reducedMotion ? 0.03 : 0.015;
    this.color = cubes[tx].color === BASE ? PHOTON : cubes[tx].color;
    this.msx = ocsOffset.x - 30;
    this.msy = ocsOffset.y + tx * ocsSpacing;
    this.mmx = ocsOffset.x + rx * ocsSpacing;
    this.mey = ocsOffset.y + N * ocsSpacing + 30;
    this.hd = this.mmx - this.msx;
    this.vd = this.mey - this.msy;
    this.td = this.hd + this.vd;
    this.curve = getBezierCurve(cubes[tx], cubes[rx]);
  }
  update() { this.progress += this.speed; return this.progress >= 1; }
  draw(ctx) {
    const d = this.progress * this.td, tail = 20;
    let mx, my, tx2, ty2, corner = false;
    if (d <= this.hd) { mx = this.msx + d; my = this.msy; tx2 = Math.max(this.msx, mx - tail); ty2 = my; }
    else {
      mx = this.mmx; my = this.msy + (d - this.hd); tx2 = mx; ty2 = Math.max(this.msy, my - tail);
      if (my - tail < this.msy) { corner = true; tx2 = this.mmx - (tail - (my - this.msy)); ty2 = this.msy; }
    }
    ctx.beginPath(); ctx.moveTo(tx2, ty2);
    if (corner) ctx.lineTo(this.mmx, this.msy);
    ctx.lineTo(mx, my);
    ctx.strokeStyle = this.color; ctx.lineWidth = 3; ctx.lineCap = "round";
    if (!reducedMotion) { ctx.shadowBlur = 10; ctx.shadowColor = this.color; }
    ctx.stroke(); ctx.shadowBlur = 0;

    const p = bezXY(this.progress, this.curve);
    if (!reducedMotion) { ctx.shadowBlur = 14; ctx.shadowColor = this.color; }
    ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fillStyle = this.color; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  }
}

const explanations = {
  ring: `<strong>Global ring.</strong> Eight cubes — each one a rack of 64 hard-wired chips — joined into one loop. Watch a photon: it leaves a cube face, flies to the OCS, bounces off <em>one mirror</em>, and lands at the next cube. The switch never reads the data; it just redirects light.`,
  slice: `<strong>Pod slicing.</strong> The mirrors re-tilted and the supercomputer became two. <em>Pod row A</em> is one private ring, <em>row B</em> another. They share zero optical links, so two customers' training jobs can't congest each other — isolation enforced by physics, not by QoS rules.`,
  tenant: `<strong>Cross-rack jobs.</strong> Logical neighbors ≠ physical neighbors. Cube 0 and cube 6 sit in different rows, yet one mirror makes them adjacent. Schedulers exploit this to build slices from whatever healthy cubes are free, anywhere in the pod.`,
  fail: `<strong>Spare-cube repair.</strong> The ring runs on 7 cubes while cube 7 idles as a hot spare. Press <em>run the failure</em>: when cube 2 dies, the controller tears down 2 circuits and raises 2 new ones — the spare is spliced in and the job's torus shape is preserved. Healing happens at <em>cube</em> granularity, not chip granularity.`,
  random: `<strong>Topology shuffle.</strong> Press again and again: every shuffle is a brand-new network, born from mirror angles alone. Because settling takes milliseconds, circuits are programmed once per job — circuit switching, not packet switching. Multiply by 6 link dimensions and you get reconfigurable 3D (even twisted) toruses.`,
};

function clearFailTimers() { failTimers.forEach(clearTimeout); failTimers = []; }

function setMode(mode) {
  // Re-pressing "shuffle" advances the deterministic cycle.
  if (mode === "random" && currentMode === "random") shuffleIdx = (shuffleIdx + 1) % SHUFFLES.length;
  currentMode = mode;
  clearFailTimers();
  // A failure run cancelled midway mustn't keep its hold: render() could then never end
  // the reconfiguration event, and the loop would never rest.
  T.hold = false;
  document.querySelectorAll(".chip[data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  $("runFail").hidden = mode !== "fail";
  $("explanation").innerHTML = explanations[mode];
  cubes.forEach((c) => { c.status = "active"; c.color = BASE; });
  pulses = [];

  if (mode === "ring") routes = [1, 2, 3, 4, 5, 6, 7, 0];
  else if (mode === "slice") {
    for (let i = 0; i < 4; i++) cubes[i].color = "#34d399";
    for (let i = 4; i < 8; i++) cubes[i].color = "#e879f9";
    routes = [1, 2, 3, 0, 5, 6, 7, 4];
  } else if (mode === "tenant") {
    [0, 1, 6, 7].forEach((i) => (cubes[i].color = "#34d399"));
    [2, 3, 4, 5].forEach((i) => (cubes[i].color = "#e879f9"));
    routes = [1, 6, 3, 4, 5, 2, 7, 0];
  } else if (mode === "fail") {
    cubes[7].status = "spare";
    routes = [1, 2, 3, 4, 5, 6, 0, null];
  } else if (mode === "random") {
    cubes.forEach((c) => (c.color = "#fb923c"));
    routes = SHUFFLES[shuffleIdx].slice();
  }
  updateMirrors();
  if (window.sim) sim.event("mode", { mode });
  reportSize();
  nudge();
}

function triggerFailure() {
  if (currentMode !== "fail") setMode("fail");
  clearFailTimers();
  failTimers.push(setTimeout(() => {
    cubes[2].status = "failed";
    T.hold = true;
    updateMirrors(); // circuits 1→2 and 2→3 drop (2 mirrors)
    setBadge("fail", "CUBE 2 DOWN");
  }, 1400));
  failTimers.push(setTimeout(() => {
    cubes[7].status = "active";
    routes = [1, 7, null, 4, 5, 6, 0, 3]; // splice: 1→7 and 7→3 rise (2 mirrors)
    T.hold = false;
    updateMirrors();
    if (!observed && window.sim) { observed = true; sim.checkpoint("observe-ocs"); }
  }, 2500));
  nudge();
}

let frameCount = 0;
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const now = performance.now();

  ctx.fillStyle = "#7e93b6"; ctx.font = "600 15px " + SANS; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText("Logical topology — 8 of 64 cubes", topoOffset.x + 195, 46);
  ctx.fillText("Palomar OCS — MEMS mirror matrix", ocsOffset.x + (N * ocsSpacing) / 2 - 20, 46);
  ctx.font = "11px " + MONO; ctx.fillStyle = "#54688c";
  ctx.fillText("what software sees", topoOffset.x + 195, 64);
  ctx.fillText("what photons see", ocsOffset.x + (N * ocsSpacing) / 2 - 20, 64);

  ctx.beginPath(); ctx.moveTo(540, 28); ctx.lineTo(540, canvas.height - 24);
  ctx.strokeStyle = "#1d2c49"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);

  const rows = [{ name: "Pod row A", x: topoOffset.x + 25 }, { name: "Pod row B", x: topoOffset.x + 245 }];
  rows.forEach((r) => {
    ctx.fillStyle = "rgba(16,28,51,.55)"; ctx.strokeStyle = "#22345a"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(r.x, topoOffset.y, 140, 455, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#9fb3d4"; ctx.font = "600 13px " + SANS; ctx.textAlign = "center";
    ctx.fillText(r.name, r.x + 70, topoOffset.y + 28);
    ctx.font = "10px " + MONO; ctx.fillStyle = "#54688c";
    ctx.fillText("4 racks · 256 chips", r.x + 70, topoOffset.y + 44);
  });

  for (let t = 0; t < N; t++) {
    const r = routes[t];
    if (r !== null && cubes[t].status !== "failed" && cubes[r].status !== "failed") {
      const c = getBezierCurve(cubes[t], cubes[r]);
      ctx.beginPath(); ctx.moveTo(c.sx, c.sy);
      ctx.bezierCurveTo(c.cp1x, c.cp1y, c.cp2x, c.cp2y, c.ex, c.ey);
      ctx.strokeStyle = "rgba(233,239,252,0.10)"; ctx.lineWidth = 2; ctx.stroke();
    }
  }

  cubes.forEach((c) => {
    const dead = c.status === "failed", spare = c.status === "spare";
    ctx.fillStyle = dead ? "#1a2336" : "#0a1426";
    ctx.strokeStyle = dead ? "#f87171" : spare ? "#54688c" : c.color;
    ctx.lineWidth = 2;
    if (spare) ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.roundRect(c.tx - 27, c.ty - 27, 54, 54, 9); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = "center";
    ctx.fillStyle = dead ? "#f87171" : spare ? "#7e93b6" : "#e9effc";
    ctx.font = "600 11px " + MONO; ctx.fillText("CUBE " + c.id, c.tx, c.ty - 3);
    ctx.font = "9px " + MONO; ctx.fillStyle = dead ? "#b35e5e" : "#54688c";
    ctx.fillText(dead ? "FAILED" : spare ? "SPARE" : "64 chips", c.tx, c.ty + 12);
  });

  let moving = false;
  ctx.lineWidth = 1; ctx.strokeStyle = "#1c2a44";
  for (let i = 0; i < N; i++) {
    const c = cubes[i];
    const lbl = c.status === "failed" ? "#f87171" : c.status === "spare" ? "#54688c" : c.color;
    ctx.beginPath(); ctx.moveTo(ocsOffset.x - 20, ocsOffset.y + i * ocsSpacing);
    ctx.lineTo(ocsOffset.x + (N - 1) * ocsSpacing + 30, ocsOffset.y + i * ocsSpacing); ctx.stroke();
    ctx.fillStyle = lbl; ctx.font = "600 11px " + MONO; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText("C" + i + " Tx", ocsOffset.x - 26, ocsOffset.y + i * ocsSpacing);
    ctx.beginPath(); ctx.moveTo(ocsOffset.x + i * ocsSpacing, ocsOffset.y - 20);
    ctx.lineTo(ocsOffset.x + i * ocsSpacing, ocsOffset.y + N * ocsSpacing + 30); ctx.stroke();
    ctx.save();
    ctx.translate(ocsOffset.x + i * ocsSpacing, ocsOffset.y + N * ocsSpacing + 42);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = lbl; ctx.textAlign = "left"; ctx.fillText("C" + i + " Rx", 0, 0);
    ctx.restore();
  }
  ctx.textBaseline = "alphabetic";

  for (let t = 0; t < N; t++) for (let x = 0; x < N; x++) {
    const m = mirrors[t][x];
    m.angle += (m.targetAngle - m.angle) * (reducedMotion ? 0.5 : 0.12);
    const isMoving = Math.abs(m.targetAngle - m.angle) > 0.01;
    if (isMoving) moving = true;
    const cx = ocsOffset.x + x * ocsSpacing, cy = ocsOffset.y + t * ocsSpacing;

    const hl = changedMirrors[t + "-" + x];
    if (hl && now - hl < 3500) {
      const a = 1 - (now - hl) / 3500;
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251,191,36," + 0.85 * a + ")"; ctx.lineWidth = 1.5; ctx.stroke();
    }

    ctx.save(); ctx.translate(cx, cy); ctx.rotate(m.angle);
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
    const on = m.targetAngle !== 0;
    if (on) {
      ctx.strokeStyle = isMoving ? "#60a5fa" : "#f8fafc";
      ctx.lineWidth = isMoving ? 2 : 3;
      if (isMoving && !reducedMotion) { ctx.shadowBlur = 6; ctx.shadowColor = "#60a5fa"; }
    } else {
      ctx.strokeStyle = isMoving ? "#475569" : "#22304d";
      ctx.lineWidth = 1;
    }
    ctx.stroke(); ctx.restore(); ctx.shadowBlur = 0;
  }

  if (T.eventActive) {
    $("tDown").textContent = Math.round(T.downTotal + (now - T.eventStart));
    if (!moving && !T.hold && now - T.eventStart > 250) {
      T.eventActive = false;
      T.downTotal += now - T.eventStart;
      $("tDown").textContent = Math.round(T.downTotal);
      const broken = routes.some((r, t) => r !== null && (cubes[t].status === "failed" || cubes[r].status === "failed"));
      if (broken) setBadge("fail", "DEGRADED");
      else setBadge("", "STABLE");
    }
  }
  $("tCirc").textContent = circuitsActive() + " / 8";

  const interval = reducedMotion ? 40 : 20;
  if (frameCount % interval === 0 && !moving && pulses.length < 60) {
    for (let t = 0; t < N; t++) {
      const r = routes[t];
      if (r !== null && cubes[t].status !== "failed" && cubes[r].status !== "failed") pulses.push(new Pulse(t, r));
    }
  }
  for (let i = pulses.length - 1; i >= 0; i--) { if (pulses[i].update()) pulses.splice(i, 1); else pulses[i].draw(ctx); }

  frameCount++;
  // Keep drawing while mirrors settle, while a reconfiguration is in progress, or while
  // the photon flow is within IDLE_MS of the last interaction. Then rest.
  return moving || T.eventActive || now < activeUntil;
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
const loop = createLoop(render, canvas);

// The photon flow rests IDLE_MS after the last interaction, so a page left open costs no
// CPU even while the sim is on screen. Choosing an operation calls nudge().
const IDLE_MS = 10000;
let activeUntil = 0;
function nudge() { activeUntil = performance.now() + IDLE_MS; loop.wake(); }

function reportSize() { requestAnimationFrame(() => { if (window.sim) sim.resize(document.body.scrollHeight + 8); }); }
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

document.querySelectorAll(".chip[data-mode]").forEach((b) =>
  b.addEventListener("click", () => setMode(b.dataset.mode)),
);
$("runFail").addEventListener("click", triggerFailure);

function start() {
  setMode("ring");
  for (let t = 0; t < N; t++) for (let x = 0; x < N; x++) mirrors[t][x].angle = mirrors[t][x].targetAngle;
  changedMirrors = {}; T.eventActive = false; T.moved = 0; T.events = 0; T.downTotal = 0;
  $("tMirrors").textContent = 0; $("tEvents").textContent = 0; setBadge("", "STABLE");
  nudge();
  reportSize();
}

window.sim = typeof createSim !== "undefined"
  ? createSim({ onInit({ theme }) { applyTheme(theme); start(); } })
  : null;
let started = false;
const origStart = start;
start = function () { if (started) return; started = true; origStart(); };
setTimeout(() => { if (!started) start(); }, 300);
