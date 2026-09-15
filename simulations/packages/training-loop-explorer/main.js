// createSim is a global from sim-sdk.js (classic script). A step-by-step walk through the training
// loop on a simple linear fit: data -> forward pass (guess a line by hand) -> loss (per-point error)
// -> gradient descent -> epochs (auto-train, loss curve) -> inference (predict y-hat). The optimizer
// path is an idealized visualization of convergence, not a real gradient step (the topic is
// calculus-free). Deterministic, theme + reduced-motion aware, no CDNs.

const app = document.getElementById("app");

const STEPS = [
  {
    id: 0, title: "1. The Data", badge: "I/O",
    desc: "Before we train, we need data. In ML, data is just points mapping inputs to outputs. <b>SRE note:</b> this data sits in storage (e.g. GCS). Your input pipeline has to stream it to the chips fast enough that they never sit idle waiting.",
    hlCode: 1
  },
  {
    id: 1, title: "2. The Guess (Forward Pass)", badge: "Compute",
    desc: "The model starts untrained. <b>Use the sliders below</b> to manually guess the slope and intercept of the line — try to fit it through the data points. Running the model on inputs to get outputs is the <b>forward pass</b>.",
    hlCode: 2
  },
  {
    id: 2, title: "3. The Error (Loss)", badge: "Metric",
    desc: "How wrong is your guess? <b>Hover any point</b> to inspect the exact distance between your prediction line and reality. The average of those distances squared is the <b>loss</b> — one number for how wrong the model is.",
    hlCode: 3
  },
  {
    id: 3, title: "4. Gradient Descent", badge: "Update",
    desc: "Guessing by hand is hard. Gradient descent automatically works out which way to tilt the line to shrink the red error lines, and nudges the <b>weights</b> (here, the slope m and intercept b you were just setting) that way. <b>The loss curve below isn't available yet</b> — we haven't trained over time.",
    hlCode: 4
  },
  {
    id: 4, title: "5. The Epoch (The Loop)", badge: "Loop",
    desc: "One <b>epoch</b> is one full pass over the entire dataset. <b>Click Auto Train</b> to watch gradient descent take over from your initial guess, tilt the line toward the best fit, and draw the loss curve dropping over epochs. (This shows the smooth <i>effect</i> of training — a real loss curve is choppier and can stall.)",
    hlCode: 0
  },
  {
    id: 5, title: "6. Inference (Prediction)", badge: "Predict",
    desc: "With the model trained, we predict outputs for new inputs. <b>Pick an input X</b> below; the model returns the expected Y (written <b>y-hat</b>) by reading the point on the trained line. No more learning — just a forward pass.",
    hlCode: 8
  }
];

let currentStep = 0;
let currentEpoch = 0;
const MAX_EPOCHS = 50;
let observed = false;
let canvas, ctx;
let REDUCE = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// User's manual guess state
let user_m = -0.5;
let user_b = 160;
let inferenceX = 50;

// Auto-run state
let isPlaying = false;
let playTimer = null;

// Interaction state
let hoveredPoint = null;
let hitBoxes = [];

// Data Points
const points = [
  { x: 10, y: 30 }, { x: 20, y: 45 }, { x: 30, y: 65 },
  { x: 40, y: 80 }, { x: 50, y: 110 }, { x: 60, y: 125 },
  { x: 70, y: 150 }, { x: 80, y: 170 }, { x: 90, y: 185 }
];

// Model parameters (Line: y = mx + b)
const m_target = 1.95; const b_target = 10; // Optimal fit
const lossHistory = [];

function easeOutQuad(t) { return t * (2 - t); }

function generateLossHistory() {
  lossHistory.length = 0;
  for (let e = 0; e <= MAX_EPOCHS; e++) {
    let progress = e / MAX_EPOCHS;
    let eased = easeOutQuad(progress);
    let m = user_m + (m_target - user_m) * eased;
    let b = user_b + (b_target - user_b) * eased;
    let totalError = 0;
    points.forEach(p => {
      totalError += Math.pow(p.y - (m * p.x + b), 2);
    });
    lossHistory.push(totalError / points.length);
  }
}

function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => { if (window.sim && sim.resize) sim.resize(document.body.scrollHeight + 8); }); }
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#3b82f6'; }

function getCurrentModel() {
  if (currentStep < 1) return null; // No guess yet

  let m = user_m;
  let b = user_b;

  if (currentStep >= 4) {
    let progress = currentEpoch / MAX_EPOCHS;
    let eased = easeOutQuad(progress);
    m = user_m + (m_target - user_m) * eased;
    b = user_b + (b_target - user_b) * eased;
  }

  // Calculate Loss (Mean Squared Error)
  let totalError = 0;
  points.forEach(p => {
    const guessY = m * p.x + b;
    totalError += Math.pow(p.y - guessY, 2);
  });
  const loss = totalError / points.length;

  return { m, b, loss };
}

function initDOM() {
  const stepsHtml = STEPS.map((step, i) => `
    <button class="step-btn ${i === currentStep ? 'active' : ''}" data-step="${i}" ${i === currentStep ? 'aria-current="step"' : ''}>
      <span>${step.title}</span>
      <span class="step-badge">${step.badge}</span>
    </button>
  `).join("");

  app.innerHTML = `
    <div class="layout-grid">
      <div class="sidebar">
        <nav class="steps-nav" aria-label="Steps">
          ${stepsHtml}
        </nav>
        <div class="explain-panel">
          <div class="e-title" id="e-title"></div>
          <div class="e-desc" id="e-desc"></div>
        </div>
        <div id="interactive-controls"></div>
        <div class="metrics">
          <div class="m-card">
            <div class="m-k">Epochs Run</div>
            <div class="m-v mono" id="m-epoch">0</div>
          </div>
          <div class="m-card">
            <div class="m-k">Mean Loss (MSE)</div>
            <div class="m-v err mono" id="m-loss">—</div>
          </div>
        </div>
      </div>

      <div class="main-content">
        <div class="stage-wrap">
          <canvas id="c"></canvas>
        </div>
        <div class="loss-wrap" id="loss-wrap-container">
          <div class="loss-header">Loss Curve (Convergence)</div>
          <div class="loss-canvas-container">
            <canvas id="loss-canvas"></canvas>
          </div>
        </div>
        <div id="code-overlay" class="code-overlay" tabindex="0" role="region" aria-label="The code for this step (scrollable)"></div>
      </div>
    </div>`;

  app.querySelectorAll(".step-btn").forEach(btn =>
    btn.addEventListener("click", () => setStep(+btn.getAttribute("data-step")))
  );

  canvas = document.getElementById("c");
  ctx = canvas.getContext("2d");

  // Setup Hover Interaction for Point Inspector
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let found = null;
    for (let i = 0; i < hitBoxes.length; i++) {
      const hb = hitBoxes[i];
      const dist = Math.sqrt(Math.pow(mouseX - hb.cx, 2) + Math.pow(mouseY - hb.cy, 2));
      if (dist < 15) { // 15px hover radius
        found = hb.point;
        break;
      }
    }

    if (found !== hoveredPoint) {
      hoveredPoint = found;
      renderCanvas();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    hoveredPoint = null;
    renderCanvas();
  });

  resizeCanvas();
}

function toggleAutoRun() {
  const btn = document.getElementById("auto-run-btn");
  if (isPlaying) {
    clearInterval(playTimer);
    isPlaying = false;
    btn.innerText = "▶ Auto Train";
    btn.classList.remove("pause");
  } else {
    if (currentEpoch >= MAX_EPOCHS) {
      currentEpoch = 0; // Restart
      generateLossHistory();
    }
    // Respect reduced-motion: jump straight to the trained state instead of animating.
    if (REDUCE) {
      currentEpoch = MAX_EPOCHS;
      const slider = document.getElementById("epoch-slider");
      if (slider) slider.value = currentEpoch;
      const lbl = document.getElementById("sv-epoch");
      if (lbl) lbl.innerText = currentEpoch;
      btn.innerText = "↻ Re-Train";
      renderCanvas();
      return;
    }
    isPlaying = true;
    btn.innerText = "❚❚ Pause Training";
    btn.classList.add("pause");
    playTimer = setInterval(() => {
      currentEpoch++;
      const slider = document.getElementById("epoch-slider");
      if (slider) slider.value = currentEpoch;
      document.getElementById("sv-epoch").innerText = currentEpoch;
      renderCanvas();

      if (currentEpoch >= MAX_EPOCHS) {
        clearInterval(playTimer);
        isPlaying = false;
        if (document.getElementById("auto-run-btn")) {
          document.getElementById("auto-run-btn").innerText = "↻ Re-Train";
          document.getElementById("auto-run-btn").classList.remove("pause");
        }
      }
    }, 150); // Slow enough to watch it learn
  }
}

function setStep(s) {
  if (isPlaying) toggleAutoRun(); // Stop playback when navigating

  if (s === 4 || s === 5) {
    if (s === 5 && currentEpoch === 0) currentEpoch = MAX_EPOCHS; // Fast forward to trained if skipping to inference
    generateLossHistory();
  }

  currentStep = s;
  if (currentStep < 4) currentEpoch = 0; // Reset epoch if stepping back
  if (currentStep === 5 && !observed && window.sim) {
    observed = true;
    sim.checkpoint("observe-epochs");
  }
  if (window.sim && sim.event) sim.event("step", { step: currentStep });
  updateUI();
}

function updateUI() {
  const s = STEPS[currentStep];

  // Update Sidebar
  app.querySelectorAll(".step-btn").forEach((btn, i) => {
    btn.classList.toggle('active', i === currentStep);
    if (i === currentStep) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
  });
  document.getElementById('e-title').innerHTML = s.title.split('. ')[1];
  document.getElementById('e-desc').innerHTML = s.desc;

  // Dynamic Controls
  const ctrl = document.getElementById("interactive-controls");

  if (currentStep >= 1 && currentStep <= 3) {
    ctrl.innerHTML = `
        <div class="slider-box">
            <div class="slider-header"><label for="m-slider">Slope (m)</label><span class="val" id="sv-m">${user_m.toFixed(2)}</span></div>
            <input type="range" id="m-slider" min="-2.0" max="4.0" step="0.05" value="${user_m}">
        </div>
        <div class="slider-box" style="margin-top: 10px;">
            <div class="slider-header"><label for="b-slider">Intercept (b)</label><span class="val" id="sv-b">${user_b}</span></div>
            <input type="range" id="b-slider" min="-50" max="250" step="1" value="${user_b}">
        </div>
    `;
    document.getElementById("m-slider").addEventListener("input", (e) => {
      user_m = parseFloat(e.target.value);
      document.getElementById("sv-m").innerText = user_m.toFixed(2);
      renderCanvas();
    });
    document.getElementById("b-slider").addEventListener("input", (e) => {
      user_b = parseInt(e.target.value);
      document.getElementById("sv-b").innerText = user_b;
      renderCanvas();
    });
  } else if (currentStep === 4) {
    ctrl.innerHTML = `
        <div class="slider-box">
            <div class="slider-header"><label for="epoch-slider">Train Model (Epochs)</label><span class="val" id="sv-epoch">${currentEpoch}</span></div>
            <input type="range" id="epoch-slider" min="0" max="${MAX_EPOCHS}" value="${currentEpoch}">
            <button id="auto-run-btn" class="btn-auto-train">▶ Auto Train</button>
        </div>
    `;
    document.getElementById("epoch-slider").addEventListener("input", (e) => {
      if (isPlaying) toggleAutoRun(); // Pause if they manually scrub
      currentEpoch = parseInt(e.target.value);
      document.getElementById("sv-epoch").innerText = currentEpoch;
      renderCanvas();
    });
    document.getElementById("auto-run-btn").addEventListener("click", toggleAutoRun);
  } else if (currentStep === 5) {
    ctrl.innerHTML = `
        <div class="slider-box">
            <div class="slider-header"><label for="inf-slider">Select Input (X)</label><span class="val" id="sv-inf">${inferenceX}</span></div>
            <input type="range" id="inf-slider" min="0" max="100" value="${inferenceX}">
        </div>
    `;
    document.getElementById("inf-slider").addEventListener("input", (e) => {
      inferenceX = parseInt(e.target.value);
      document.getElementById("sv-inf").innerText = inferenceX;
      renderCanvas();
      renderCodeOverlay();
    });
  } else {
    ctrl.innerHTML = '';
  }

  const lossWrap = document.getElementById("loss-wrap-container");
  if (lossWrap) {
    lossWrap.style.display = currentStep >= 1 && currentStep <= 4 ? "flex" : "none";
  }

  resizeCanvas(); // Force the canvas to recalculate its resolution after becoming visible
  renderCodeOverlay();
  reportSize();
}

function renderCodeOverlay() {
  const s = STEPS[currentStep];
  const lines = [
    `<span class="kw">for</span> epoch <span class="kw">in</span> range(epochs):  <span class="cm">// the training loop (pseudocode)</span>`,
    `    batch <span class="op">=</span> dataset.get_batch()`,
    `    predictions <span class="op">=</span> model.<span class="op">forward</span>(batch.x)`,
    `    loss <span class="op">=</span> compute_mse(predictions, batch.y)`,
    `    model.<span class="op">update_weights</span>(loss)`,
    ` `,
    `<span class="cm">// --- After Training (Inference) ---</span>`,
    `<span class="kw">let</span> new_x <span class="op">=</span> <span class="hl-bg">${currentStep === 5 ? inferenceX : '...'}</span>;`,
    `<span class="kw">let</span> y_hat <span class="op">=</span> model.<span class="op">predict</span>(new_x);`
  ];

  const highlightedLines = lines.map((line, idx) => {
    return idx === s.hlCode ? `<span class="hl">${line}</span>` : line;
  });

  document.getElementById('code-overlay').innerHTML = highlightedLines.join('\n');
}

function resizeCanvas() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const lcanvas = document.getElementById("loss-canvas");
  if (lcanvas) {
    lcanvas.width = lcanvas.clientWidth * dpr;
    lcanvas.height = lcanvas.clientHeight * dpr;
    const lctx = lcanvas.getContext("2d");
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  renderCanvas();
}

function renderCanvas() {
  if (!ctx) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const cGrid = cssVar("--border");
  const cPoint = cssVar("--fg");
  const cLine = cssVar("--primary");
  const cLoss = cssVar("--bad");
  const cWarn = cssVar("--warn");
  const cPanel = cssVar("--panel");

  // Coordinate mapping (Data range X: 0-100, Y: 0-200)
  const padX = 40;
  const padY = 40;

  const mapX = (x) => padX + (x / 100) * (w - padX * 2);
  const mapY = (y) => h - padY - (y / 200) * (h - padY * 2);

  // Reset hitboxes for the new render frame
  hitBoxes = [];

  // Draw Grid & Axes
  ctx.strokeStyle = cGrid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, padY); ctx.lineTo(padX, h - padY); // Y Axis
  ctx.lineTo(w - padX, h - padY); // X Axis
  ctx.stroke();

  ctx.fillStyle = cssVar("--muted");
  ctx.font = "12px sans-serif";
  ctx.fillText("Data Inputs (X)", w / 2 - 40, h - 10);
  ctx.save();
  ctx.translate(15, h / 2 + 40);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Answers (Y)", 0, 0);
  ctx.restore();

  // Get Model
  const model = getCurrentModel();

  // Update Metrics UI
  document.getElementById('m-epoch').innerText = currentStep >= 4 ? currentEpoch : "0";
  document.getElementById('m-loss').innerText = model ? Math.round(model.loss).toLocaleString() : "—";

  // Draw global loss lines (If Step >= 2) - faded so the hover stands out
  if (currentStep >= 2 && currentStep <= 4 && model) {
    ctx.strokeStyle = `color-mix(in srgb, ${cLoss} 60%, transparent)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    points.forEach(p => {
      const guessY = model.m * p.x + model.b;
      ctx.moveTo(mapX(p.x), mapY(p.y));
      ctx.lineTo(mapX(p.x), mapY(guessY));
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw Model Line (If Step >= 1)
  if (currentStep >= 1 && model) {
    ctx.strokeStyle = cLine;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(mapX(0), mapY(model.m * 0 + model.b));
    ctx.lineTo(mapX(100), mapY(model.m * 100 + model.b));
    ctx.stroke();

    ctx.fillStyle = cLine;
    ctx.font = "bold 14px monospace";
    ctx.fillText(`Model: y = ${model.m.toFixed(2)}x + ${Math.round(model.b)}`, mapX(5), mapY(190));
  }

  // Draw Data Points and populate hitboxes
  points.forEach(p => {
    const px = mapX(p.x);
    const py = mapY(p.y);

    hitBoxes.push({ cx: px, cy: py, point: p });

    ctx.beginPath();
    if (hoveredPoint === p && currentStep >= 1 && currentStep <= 4) {
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fillStyle = cLoss;
      ctx.fill();
      ctx.strokeStyle = cPanel;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.strokeStyle = `color-mix(in srgb, ${cLoss} 40%, transparent)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = cPoint;
      ctx.fill();
      ctx.strokeStyle = cssVar("--bg");
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  // Step 6: Inference Visualization
  if (currentStep === 5 && model) {
    const infY = model.m * inferenceX + model.b;
    const px = mapX(inferenceX);
    const py = mapY(infY);

    ctx.strokeStyle = cWarn;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(px, mapY(0));
    ctx.lineTo(px, py);
    ctx.lineTo(mapX(0), py);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fillStyle = cWarn;
    ctx.fill();
    ctx.strokeStyle = cPanel;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = cWarn;
    ctx.font = "bold 14px monospace";
    ctx.fillText(`X = ${inferenceX}`, px + 8, mapY(0) - 8);
    ctx.fillText(`ŷ = ${Math.round(infY)}`, mapX(0) + 8, py - 8);

    ctx.fillStyle = cPanel;
    ctx.beginPath();
    ctx.roundRect(px + 15, py - 35, 100, 30, 6);
    ctx.fill();
    ctx.strokeStyle = cssVar("--border");
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = cssVar("--fg");
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(`ŷ = ${Math.round(infY)}`, px + 25, py - 16);
  }

  // Point Inspector Overlay (Draw last so it's on top) for Steps 1-4
  if (hoveredPoint && model && currentStep >= 1 && currentStep <= 4) {
    const p = hoveredPoint;
    const guessY = model.m * p.x + model.b;
    const dist = p.y - guessY;
    const squaredError = Math.pow(dist, 2);

    const px = mapX(p.x);
    const py1 = mapY(p.y);
    const py2 = mapY(guessY);

    ctx.strokeStyle = cLoss;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(px, py1);
    ctx.lineTo(px, py2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py2, 5, 0, Math.PI * 2);
    ctx.fillStyle = cPanel;
    ctx.fill();
    ctx.strokeStyle = cLine;
    ctx.lineWidth = 2;
    ctx.stroke();

    const tooltipW = 160;
    const tooltipH = 90;
    let tx = px + 15;
    let ty = (py1 + py2) / 2 - tooltipH / 2;

    if (tx + tooltipW > w - 10) tx = px - tooltipW - 15;
    if (ty < 10) ty = 10;
    if (ty + tooltipH > h - 10) ty = h - tooltipH - 10;

    ctx.fillStyle = cPanel;
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tooltipW, tooltipH, 8);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = cssVar("--border");
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = cssVar("--fg");
    ctx.font = "12px sans-serif";
    ctx.fillText(`Input X: ${p.x}`, tx + 12, ty + 20);

    ctx.font = "11px monospace";
    ctx.fillStyle = cssVar("--muted");
    ctx.fillText(`Actual Y:     ${Math.round(p.y)}`, tx + 12, ty + 40);
    ctx.fillText(`Predicted ŷ:  ${Math.round(guessY)}`, tx + 12, ty + 55);

    ctx.fillStyle = cLoss;
    ctx.font = "bold 11px monospace";
    ctx.fillText(`Distance:      ${Math.abs(Math.round(dist))}`, tx + 12, ty + 70);
    ctx.fillText(`Squared error: ${Math.round(squaredError)}`, tx + 12, ty + 85);
  }

  renderLossGraph();
}

function renderLossGraph() {
  const lcanvas = document.getElementById("loss-canvas");
  if (!lcanvas || currentStep === 5) return; // Hidden on step 5
  const lctx = lcanvas.getContext("2d");
  const w = lcanvas.clientWidth;
  const h = lcanvas.clientHeight;
  lctx.clearRect(0, 0, w, h);

  const padX = 40;
  const padY = 20;

  // Axes (Always visible)
  lctx.strokeStyle = cssVar("--border");
  lctx.lineWidth = 1;
  lctx.beginPath();
  lctx.moveTo(padX, 10); lctx.lineTo(padX, h - padY);
  lctx.lineTo(w - 15, h - padY);
  lctx.stroke();

  // Empty State Placeholder logic
  if (currentStep < 4) {
    lctx.fillStyle = cssVar("--muted");
    lctx.font = "italic 13px sans-serif";
    lctx.textAlign = "center";
    lctx.fillText("Loss curve not available.", w / 2 + 10, h / 2 - 10);
    lctx.fillText("Requires training across multiple epochs.", w / 2 + 10, h / 2 + 10);
    lctx.textAlign = "left";
    return;
  }

  // Standard Graph Rendering (Step 4)
  const maxLoss = lossHistory[0];
  const mapX = (epoch) => padX + (epoch / MAX_EPOCHS) * (w - padX - 15);
  const mapY = (loss) => h - padY - (loss / maxLoss) * (h - padY - 10);

  lctx.fillStyle = cssVar("--muted");
  lctx.font = "10px sans-serif";
  lctx.fillText("Epochs", w / 2, h - 5);
  lctx.save();
  lctx.translate(15, h / 2);
  lctx.rotate(-Math.PI / 2);
  lctx.textAlign = "center";
  lctx.fillText("Loss", 0, 0);
  lctx.restore();

  // Faint full expected curve
  lctx.beginPath();
  lctx.moveTo(mapX(0), mapY(lossHistory[0]));
  for (let i = 1; i <= MAX_EPOCHS; i++) {
    lctx.lineTo(mapX(i), mapY(lossHistory[i]));
  }
  lctx.strokeStyle = `color-mix(in srgb, ${cssVar("--bad")} 22%, transparent)`;
  lctx.lineWidth = 2;
  lctx.stroke();

  // Active curve up to currentEpoch
  lctx.beginPath();
  lctx.moveTo(mapX(0), mapY(lossHistory[0]));
  for (let i = 1; i <= currentEpoch; i++) {
    lctx.lineTo(mapX(i), mapY(lossHistory[i]));
  }
  lctx.strokeStyle = cssVar("--bad");
  lctx.lineWidth = 3;
  lctx.stroke();

  // Current point marker
  const cx = mapX(currentEpoch);
  const cy = mapY(lossHistory[currentEpoch]);
  lctx.beginPath();
  lctx.arc(cx, cy, 4, 0, Math.PI * 2);
  lctx.fillStyle = cssVar("--bad");
  lctx.fill();
  lctx.strokeStyle = cssVar("--bg");
  lctx.lineWidth = 1.5;
  lctx.stroke();

  // Highlight Convergence
  if (currentEpoch > 35) {
    lctx.fillStyle = cssVar("--good");
    lctx.font = "bold 12px sans-serif";
    lctx.fillText("Converged", cx - 65, cy - 15);
  }
}

window.sim = createSim({
  onInit({ theme, reducedMotion }) {
    REDUCE = REDUCE || reducedMotion;
    applyTheme(theme);
    initDOM();
    setStep(0);
  }
});

new ResizeObserver(() => reportSize()).observe(document.body);

// Fallback for standalone preview (no host init)
setTimeout(() => {
  if ((!window.sim || !sim.isInitialized()) && !document.getElementById("c")) {
    initDOM();
    setStep(0);
  }
}, 300);
