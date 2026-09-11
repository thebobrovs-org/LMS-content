// `createSim` is provided as a global by sim-sdk.js (loaded as a classic script
// before this one) so the bundle works in the opaque-origin sandbox.
//
// Renders an N×N×N grid of TPU chips as a 3D torus: each chip has six ICI links
// (±X, ±Y, ±Z); edges wrap around to close the torus. Drag or use the arrow keys to
// orbit; click a chip, pick it from the list, or step through chips with Enter, to
// highlight its six neighbors; toggle the wrap-around links. Redraws when resized.

const app = document.getElementById("app");

let N = 4;
let wrap = true;
let selected = null; // index into chips, or null
let inspected = false; // checkpoint latch
let yaw = -0.7;
let pitch = -0.5;

let canvas, ctx, readout, picker;
let chips = []; // { x, y, z }

function idx(x, y, z) {
  return x * N * N + y * N + z;
}

function buildChips() {
  chips = [];
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) chips.push({ x, y, z });
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme; // "system"
  }
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Six ICI neighbors of a chip, applying torus wrap-around when enabled.
function neighbors(c) {
  const out = [];
  const axes = [
    ["x", 1], ["x", -1],
    ["y", 1], ["y", -1],
    ["z", 1], ["z", -1],
  ];
  for (const [axis, d] of axes) {
    const v = c[axis] + d;
    let nv = v;
    let isWrap = false;
    if (v < 0 || v >= N) {
      if (!wrap) continue;
      nv = (v + N) % N;
      isWrap = true;
    }
    const nc = { x: c.x, y: c.y, z: c.z };
    nc[axis] = nv;
    out.push({ index: idx(nc.x, nc.y, nc.z), axis, isWrap });
  }
  return out;
}

function project(c, w, h) {
  const cx = (N - 1) / 2;
  let X = c.x - cx, Y = c.y - cx, Z = c.z - cx;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  let x1 = X * cy + Z * sy;
  let z1 = -X * sy + Z * cy;
  let y1 = Y;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  let y2 = y1 * cp - z1 * sp;
  let z2 = y1 * sp + z1 * cp;
  const scale = Math.min(w, h) / (N + 1.5);
  return { sx: w / 2 + x1 * scale, sy: h / 2 + y2 * scale, depth: z2 };
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const pts = chips.map((c) => project(c, w, h));
  const sel = selected != null ? chips[selected] : null;
  const nbr = sel ? neighbors(sel) : [];
  const nbrSet = new Set(nbr.map((n) => n.index));

  const colBorder = cssVar("--border") || "#888";
  const colLink = cssVar("--link") || colBorder;
  const colChip = cssVar("--accent") || "#0d9488";
  const colSel = cssVar("--primary") || "#2563eb";
  const colWrap = cssVar("--danger") || "#dc2626";
  const colNbr = cssVar("--nbr") || colSel;

  // --- Links ---
  ctx.lineWidth = 1;
  for (let i = 0; i < chips.length; i++) {
    const c = chips[i];
    for (const [axis, sign] of [["x", 1], ["y", 1], ["z", 1]]) {
      const v = c[axis] + 1;
      const edge = v >= N;
      if (edge && !wrap) continue;
      const nc = { x: c.x, y: c.y, z: c.z };
      nc[axis] = edge ? 0 : v;
      const a = pts[i];
      const b = pts[idx(nc.x, nc.y, nc.z)];
      const highlight =
        sel && (i === selected || idx(nc.x, nc.y, nc.z) === selected) &&
        (nbrSet.has(i) || nbrSet.has(idx(nc.x, nc.y, nc.z)) || i === selected ||
          idx(nc.x, nc.y, nc.z) === selected);
      if (edge) {
        ctx.strokeStyle = colWrap;
        ctx.globalAlpha = highlight ? 0.9 : 0.35;
        ctx.setLineDash([4, 3]);
      } else {
        ctx.strokeStyle = highlight ? colNbr : colLink;
        ctx.globalAlpha = highlight ? 0.9 : 0.22;
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // --- Chips (painter's algorithm: far to near) ---
  const order = chips.map((_, i) => i).sort((a, b) => pts[a].depth - pts[b].depth);
  for (const i of order) {
    const p = pts[i];
    const isSel = i === selected;
    const isNbr = nbrSet.has(i);
    const r = 5 + (p.depth + N / 2) * 0.9 + (isSel ? 3 : 0);
    ctx.globalAlpha = sel && !isSel && !isNbr ? 0.5 : 1;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, Math.max(3, r), 0, Math.PI * 2);
    ctx.fillStyle = isSel ? colSel : isNbr ? colNbr : colChip;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = cssVar("--bg") || "#fff";
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  renderReadout(sel, nbr);
}

function renderReadout(sel, nbr) {
  if (picker.value !== (selected == null ? "" : String(selected))) picker.value = selected == null ? "" : String(selected);
  if (!sel) {
    readout.innerHTML = `<span class="muted">Drag or use the arrow keys to rotate · click a chip, pick one from the list, or press Enter on the view to step through chips and inspect their ICI neighbors.</span>`;
    return;
  }
  const wraps = nbr.filter((n) => n.isWrap).length;
  const coords = (i) => {
    const c = chips[i];
    return `(${c.x},${c.y},${c.z})`;
  };
  readout.innerHTML =
    `<b>Chip ${coords(selected)}</b> — ${nbr.length} ICI neighbor${nbr.length === 1 ? "" : "s"}` +
    (wraps ? ` <span class="wrap">(${wraps} via wrap-around)</span>` : "") +
    `<div class="nbrs">${nbr
      .map(
        (n) =>
          `<span class="chip-tag ${n.isWrap ? "is-wrap" : ""}">${n.axis.toUpperCase()} → ${coords(n.index)}</span>`,
      )
      .join("")}</div>`;
}

function hitTest(mx, my) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  let best = null, bestD = 14 * 14;
  for (let i = 0; i < chips.length; i++) {
    const p = project(chips[i], w, h);
    const dx = p.sx - mx, dy = p.sy - my;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

/** Select a chip (or none) from any input: pointer, the list, or the keyboard. The first selection completes the checkpoint. */
function select(index) {
  selected = index;
  if (index != null) {
    if (!inspected) { inspected = true; sim.checkpoint("inspect-neighbors"); }
    sim.event("select-chip", { chip: chips[index] });
  }
  render();
}

/** The keys the view answers to: arrows rotate, Enter (Shift+Enter) steps through the chips, Escape clears, Home resets. */
function onKey(e) {
  const step = 0.15;
  switch (e.key) {
    case "ArrowLeft": yaw -= step; break;
    case "ArrowRight": yaw += step; break;
    case "ArrowUp": pitch = Math.max(-1.4, pitch - step); break;
    case "ArrowDown": pitch = Math.min(1.4, pitch + step); break;
    case "Enter": case " ": select(selected == null ? (e.shiftKey ? chips.length - 1 : 0) : (selected + (e.shiftKey ? -1 : 1) + chips.length) % chips.length); e.preventDefault(); return;
    case "Escape": select(null); return;
    case "Home": yaw = -0.7; pitch = -0.5; break;
    default: return;
  }
  e.preventDefault();
  render();
}

function mount() {
  app.innerHTML = `
    <div class="controls">
      <label><input type="checkbox" id="wrap" ${wrap ? "checked" : ""}/> Wrap-around links (torus)</label>
      <button id="reset" class="secondary">Reset view</button>
      <label>Chip <select id="chip" aria-label="chip to inspect"><option value="">none</option>${chips.map((c, i) => `<option value="${i}">(${c.x},${c.y},${c.z})</option>`).join("")}</select></label>
    </div>
    <canvas id="c" width="600" height="380" tabindex="0" role="img" aria-label="3D torus of ${N * N * N} chips. Arrow keys rotate, Enter steps through the chips, Escape clears, Home resets the view."></canvas>
    <div id="readout" class="readout" aria-live="polite"></div>
    <div class="legend">
      <span class="key"><i class="dot chip"></i> chip</span>
      <span class="key"><i class="dot sel"></i> selected</span>
      <span class="key"><i class="dot nbr"></i> neighbor</span>
      <span class="key"><i class="dash"></i> wrap-around link</span>
      <span class="muted">${N}×${N}×${N} = ${N * N * N} chips · 6 ICI links each</span>
    </div>`;

  canvas = app.querySelector("#c");
  ctx = canvas.getContext("2d");
  readout = app.querySelector("#readout");
  picker = app.querySelector("#chip");

  picker.addEventListener("change", (e) => select(e.target.value === "" ? null : Number(e.target.value)));
  canvas.addEventListener("keydown", onKey);
  // The canvas draws at its CSS size, so a narrower or wider host means a redraw.
  new ResizeObserver(() => { render(); reportSize(); }).observe(canvas);

  app.querySelector("#wrap").addEventListener("change", (e) => {
    wrap = e.target.checked;
    render();
  });
  app.querySelector("#reset").addEventListener("click", () => {
    yaw = -0.7; pitch = -0.5; selected = null;
    render();
  });

  let dragging = false, moved = false, lx = 0, ly = 0;
  const onDown = (e) => {
    dragging = true; moved = false;
    const p = pointer(e);
    lx = p.x; ly = p.y;
  };
  const onMove = (e) => {
    if (!dragging) return;
    const p = pointer(e);
    const dx = p.x - lx, dy = p.y - ly;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    yaw += dx * 0.01;
    pitch += dy * 0.01;
    pitch = Math.max(-1.4, Math.min(1.4, pitch));
    lx = p.x; ly = p.y;
    render();
  };
  const onUp = (e) => {
    if (dragging && !moved) {
      const p = pointer(e);
      const hit = hitTest(p.x, p.y);
      if (hit != null) select(hit); else render();
    }
    dragging = false;
  };
  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  render();
  reportSize();
}

function pointer(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

const sim = createSim({
  onInit({ props, theme }) {
    const n = Number(props?.n);
    N = Number.isFinite(n) && n >= 2 && n <= 8 ? Math.floor(n) : 4;
    applyTheme(theme);
    buildChips();
    mount();
  },
});

// Fallback for opening the bundle directly (no host init): render with defaults.
setTimeout(() => {
  if (!sim.isInitialized() && chips.length === 0) {
    buildChips();
    mount();
  }
}, 300);
