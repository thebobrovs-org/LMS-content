// createSim is a global from sim-sdk.js (classic script). A single neuron (2 weights + bias + sigmoid)
// learns to classify cars (price, color -> buy/walk) by REAL gradient descent: it computes gradients,
// steps the weights down the loss, and early-stops near zero. The weights ARE the model — what a
// checkpoint saves and what fills HBM at scale. Then run one forward pass to predict a new car
// (inference). Theme + reduced-motion aware, no CDNs.

const app = document.getElementById("app");

const DATA = [
  { id: 1, price: 9, color: 8, target: 0, label: "Too expensive" },
  { id: 2, price: 3, color: 4, target: 1, label: "Cheap, ok color" },
  { id: 3, price: 4, color: 9, target: 1, label: "Good price, great color" },
  { id: 4, price: 8, color: 2, target: 0, label: "Expensive, bad color" },
  { id: 5, price: 2, color: 8, target: 1, label: "Steal — buy it" }
];
const LR = 0.5;

// State (fixed initial weights -> deterministic first paint; Reset randomizes)
let w1 = -0.8, w2 = 0.6, b = 0.2;
let epoch = 0;
let isTraining = false, converged = false, observed = false;
let infPrice = 5, infColor = 5, infResult = null;
let timer = null;
let REDUCE = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function evaluate() {
  let total = 0;
  const predictions = DATA.map(car => {
    const z = (car.price / 10) * w1 + (car.color / 10) * w2 + b;
    const prediction = sigmoid(z);
    total += (prediction - car.target) ** 2;
    return { id: car.id, prediction };
  });
  return { predictions, meanLoss: total / DATA.length };
}

function trainStep() {
  let g1 = 0, g2 = 0, gb = 0;
  DATA.forEach(car => {
    const np = car.price / 10, nc = car.color / 10;
    const error = sigmoid(np * w1 + nc * w2 + b) - car.target;
    g1 += error * np; g2 += error * nc; gb += error;
  });
  const n = DATA.length;
  w1 -= LR * (g1 / n); w2 -= LR * (g2 / n); b -= LR * (gb / n);
  epoch++;
}

function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => { if (window.sim && sim.resize) sim.resize(document.body.scrollHeight + 8); }); }

// Boundary line (where z = 0) in graph coords (x = price*10, y = 100 - color*10)
function lineCoords() {
  if (Math.abs(w2) < 0.001) {
    const xv = ((-10 * b) / w1) * 10;
    return { x1: xv, y1: 0, x2: xv, y2: 100 };
  }
  const yAtX0 = (-10 * b) / w2;
  const yAtX10 = (-w1 * 10 - 10 * b) / w2;
  return { x1: 0, y1: 100 - yAtX0 * 10, x2: 100, y2: 100 - yAtX10 * 10 };
}

function graphSVG(predictions) {
  let grid = "";
  for (let i = 0; i <= 10; i++) {
    grid += `<line x1="${i * 10}" y1="0" x2="${i * 10}" y2="100" stroke="var(--border)" stroke-width="0.4"/>`;
    grid += `<line x1="0" y1="${i * 10}" x2="100" y2="${i * 10}" stroke="var(--border)" stroke-width="0.4"/>`;
  }
  const l = lineCoords();
  const line = `<line x1="${l.x1.toFixed(1)}" y1="${l.y1.toFixed(1)}" x2="${l.x2.toFixed(1)}" y2="${l.y2.toFixed(1)}" stroke="var(--neuron)" stroke-width="1.6" stroke-dasharray="3,2"/>`;
  let pts = "";
  DATA.forEach(car => {
    const x = car.price * 10, y = 100 - car.color * 10;
    const pred = predictions.find(p => p.id === car.id).prediction;
    const predC = pred > 0.5 ? "var(--good)" : "var(--bad)";
    const targC = car.target === 1 ? "var(--good)" : "var(--bad)";
    pts += `<circle cx="${x}" cy="${y}" r="3.6" fill="none" stroke="${targC}" stroke-width="1"/>`;
    pts += `<circle cx="${x}" cy="${y}" r="2" fill="${predC}"/>`;
  });
  let inf = "";
  if (infResult) {
    const ix = infPrice * 10, iy = 100 - infColor * 10;
    inf = `<circle cx="${ix}" cy="${iy}" r="5" fill="none" stroke="var(--warn)" stroke-width="2"/><circle cx="${ix}" cy="${iy}" r="2.6" fill="var(--warn)"/>`;
  }
  return `<svg viewBox="0 0 100 100" role="img" aria-label="decision graph: price versus color, with the learned boundary line">${grid}${line}${pts}${inf}</svg>`;
}

function initDOM() {
  app.innerHTML = `
    <div class="panel">
      <p class="hint">A <b>neuron</b> is the smallest real model: it takes inputs (a car's <b>price</b> and <b>color</b>), multiplies each by a learned <b>weight</b>, adds a <b>bias</b>, and squashes the result to a 0–1 score. <b>Train</b> it and gradient descent tunes those three numbers until the line separates buy from walk. Then <b>predict</b> a new car.</p>
    </div>

    <div class="panel diagram" tabindex="0" role="region" aria-label="Live network data flow">
      <h2>Live network data flow</h2>
      <svg viewBox="0 0 800 232" role="img" aria-label="neuron diagram: price and color inputs flow through weights into the neuron, out to a guess, with the optimizer updating the weights">
        <defs>
          <marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker>
        </defs>
        <g color="var(--bad)"><line x1="130" y1="60" x2="306" y2="95" stroke="var(--bad)" stroke-width="2" marker-end="url(#ar)"/></g>
        <g color="var(--primary)"><line x1="130" y1="160" x2="306" y2="125" stroke="var(--primary)" stroke-width="2" marker-end="url(#ar)"/></g>
        <g color="var(--good)"><line x1="396" y1="110" x2="514" y2="110" stroke="var(--good)" stroke-width="2" marker-end="url(#ar)"/></g>
        <g color="var(--warn)"><line x1="580" y1="110" x2="675" y2="110" stroke="var(--warn)" stroke-width="2" marker-end="url(#ar)"/>
        <path d="M730 142 L730 214 L250 214 L250 142" fill="none" stroke="var(--warn)" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#ar)"/></g>

        <circle cx="100" cy="60" r="28" fill="var(--inset)" stroke="var(--bad)" stroke-width="3"/>
        <text x="100" y="65" text-anchor="middle" fill="var(--bad)" font-size="14" font-weight="bold">Price</text>
        <circle cx="100" cy="160" r="28" fill="var(--inset)" stroke="var(--primary)" stroke-width="3"/>
        <text x="100" y="165" text-anchor="middle" fill="var(--primary)" font-size="14" font-weight="bold">Color</text>

        <circle cx="350" cy="110" r="46" fill="var(--inset)" stroke="var(--neuron)" stroke-width="3"/>
        <text x="350" y="104" text-anchor="middle" fill="var(--neuron)" font-size="18" font-weight="bold">Σ + σ</text>
        <text x="350" y="124" text-anchor="middle" fill="var(--fg)" font-size="11">bias <tspan id="nd-b">0.00</tspan></text>
        <text x="350" y="139" text-anchor="middle" fill="var(--muted)" font-size="10">(neuron)</text>

        <circle cx="550" cy="110" r="28" fill="var(--inset)" stroke="var(--good)" stroke-width="3"/>
        <text x="550" y="114" text-anchor="middle" fill="var(--good)" font-size="13" font-weight="bold">Guess</text>

        <rect x="680" y="80" width="100" height="62" rx="8" fill="var(--inset)" stroke="var(--warn)" stroke-width="3"/>
        <text x="730" y="104" text-anchor="middle" fill="var(--warn)" font-size="13" font-weight="bold">Optimizer</text>
        <text x="730" y="124" text-anchor="middle" fill="var(--fg)" font-size="11">loss <tspan id="nd-loss">0.00</tspan></text>

        <text x="206" y="64" fill="var(--bad)" font-size="13" font-weight="bold" transform="rotate(10,206,64)">w₁ <tspan id="nd-w1">0.00</tspan></text>
        <text x="206" y="166" fill="var(--primary)" font-size="13" font-weight="bold" transform="rotate(-10,206,166)">w₂ <tspan id="nd-w2">0.00</tspan></text>
        <text x="490" y="206" fill="var(--warn)" font-size="11" font-weight="bold">updates the weights to cut the loss</text>
      </svg>
    </div>

    <div class="cols">
      <div class="col">
        <div class="panel">
          <h2>Decision graph</h2>
          <div class="graph-box"><div id="graph"></div><div class="axlabel x">Price →</div><div class="axlabel y">Color →</div></div>
          <div class="legend">
            <div class="it"><span class="dot" style="background:var(--good)"></span>Buy</div>
            <div class="it"><span class="dot" style="background:var(--bad)"></span>Walk</div>
            <div class="it"><span class="dot" style="background:var(--neuron)"></span>Boundary</div>
            <div class="it"><span class="dot" style="background:var(--warn)"></span>New car</div>
          </div>
        </div>
        <div class="panel">
          <h2>Test a new car (inference)</h2>
          <div class="inf-grid">
            <div><label for="inf-price">Price (1–10)</label><input type="number" id="inf-price" min="1" max="10" value="${infPrice}"></div>
            <div><label for="inf-color">Color (1–10)</label><input type="number" id="inf-color" min="1" max="10" value="${infColor}"></div>
          </div>
          <button class="btn run" id="btn-infer">Run inference</button>
          <div id="inf-out"></div>
        </div>
      </div>

      <div class="col">
        <div class="panel">
          <div class="train-head"><h2 style="margin:0">Training controls</h2><span class="ep">epoch <span id="ep-n">0</span></span></div>
          <div class="btn-row">
            <button class="btn step" id="btn-step">Step (+1 epoch)</button>
            <button class="btn train" id="btn-train">Auto Train</button>
          </div>
          <button class="btn reset" id="btn-reset">Reset network</button>
          <div class="converged" id="converged">🎉 <b>Converged</b> — loss fell below 0.01. The neuron learned the rule; those weights are the trained model.</div>
          <div class="metrics">
            <div class="m-card"><div class="m-k">Epochs run</div><div class="m-v" id="m-ep">0</div></div>
            <div class="m-card"><div class="m-k">Mean loss</div><div class="m-v loss" id="m-loss">—</div></div>
          </div>
        </div>
        <div class="panel">
          <h2>Internal parameters (live) — the model</h2>
          <div class="param w1"><div class="row"><span class="nm">Price weight (w₁)</span><span class="v" id="pv-w1">0</span></div><div class="track"><span class="mid"></span><span class="fill" id="pf-w1"></span></div></div>
          <div class="param w2"><div class="row"><span class="nm">Color weight (w₂)</span><span class="v" id="pv-w2">0</span></div><div class="track"><span class="mid"></span><span class="fill" id="pf-w2"></span></div></div>
          <div class="param b"><div class="row"><span class="nm">Baseline bias (b)</span><span class="v" id="pv-b">0</span></div><div class="track"><span class="mid"></span><span class="fill" id="pf-b"></span></div></div>
        </div>
      </div>
    </div>`;

  document.getElementById("btn-step").addEventListener("click", () => { if (!converged) { trainStep(); update(); } });
  document.getElementById("btn-train").addEventListener("click", toggleTrain);
  document.getElementById("btn-reset").addEventListener("click", reset);
  document.getElementById("btn-infer").addEventListener("click", runInference);
  document.getElementById("inf-price").addEventListener("input", (e) => { infPrice = clamp(+e.target.value); });
  document.getElementById("inf-color").addEventListener("input", (e) => { infColor = clamp(+e.target.value); });
}

function clamp(v) { return Math.max(1, Math.min(10, isFinite(v) ? v : 1)); }

function setBar(fillId, valId, v) {
  document.getElementById(valId).textContent = v.toFixed(3);
  const f = document.getElementById(fillId);
  f.style.width = Math.min(Math.abs(v) * 10, 50) + "%";
  f.style.transform = v < 0 ? "translateX(-100%)" : "none";
}

function update() {
  const { predictions, meanLoss } = evaluate();

  document.getElementById("nd-w1").textContent = w1.toFixed(2);
  document.getElementById("nd-w2").textContent = w2.toFixed(2);
  document.getElementById("nd-b").textContent = b.toFixed(2);
  document.getElementById("nd-loss").textContent = meanLoss.toFixed(2);

  document.getElementById("graph").innerHTML = graphSVG(predictions);

  document.getElementById("ep-n").textContent = epoch;
  document.getElementById("m-ep").textContent = epoch;
  document.getElementById("m-loss").textContent = meanLoss.toFixed(3);

  setBar("pf-w1", "pv-w1", w1);
  setBar("pf-w2", "pv-w2", w2);
  setBar("pf-b", "pv-b", b);

  document.getElementById("converged").classList.toggle("show", converged);
  const tb = document.getElementById("btn-train");
  tb.textContent = isTraining ? "Pause training" : (converged ? "Re-train" : "Auto Train");
  tb.classList.toggle("on", isTraining);
  document.getElementById("btn-step").disabled = isTraining || converged;

  if (meanLoss < 0.01 && !converged) {
    converged = true;
    if (isTraining) stopTrain();
    document.getElementById("converged").classList.add("show");
    document.getElementById("btn-train").textContent = "Re-train";
    document.getElementById("btn-train").classList.remove("on");
    document.getElementById("btn-step").disabled = true;
    if (!observed && window.sim) { observed = true; sim.checkpoint("observe-convergence"); }
  }
  reportSize();
}

function stopTrain() { clearInterval(timer); timer = null; isTraining = false; }

function toggleTrain() {
  if (isTraining) { stopTrain(); update(); return; }
  if (converged) { converged = false; epoch = 0; w1 = -0.8; w2 = 0.6; b = 0.2; } // re-train from the fixed start
  if (REDUCE) {
    // No animation: train to convergence (or a cap) in one go.
    let i = 0;
    while (evaluate().meanLoss >= 0.01 && i < 2000) { trainStep(); i++; }
    update();
    return;
  }
  isTraining = true;
  update();
  // A few steps per tick so it converges in a few seconds, not ~25s, while still animating smoothly.
  timer = setInterval(() => {
    for (let i = 0; i < 4 && evaluate().meanLoss >= 0.01; i++) trainStep();
    update();
  }, 50);
}

function reset() {
  stopTrain();
  converged = false;
  w1 = Math.random() * 2 - 1; w2 = Math.random() * 2 - 1; b = Math.random() * 2 - 1;
  epoch = 0; infResult = null;
  document.getElementById("inf-out").innerHTML = "";
  update();
}

function runInference() {
  const z = (infPrice / 10) * w1 + (infColor / 10) * w2 + b;
  infResult = { prediction: sigmoid(z) };
  const buy = infResult.prediction > 0.5;
  document.getElementById("inf-out").innerHTML = `
    <div class="inf-result ${buy ? "buy" : "walk"}">
      <div class="k">Network score</div>
      <div class="score">${(infResult.prediction * 100).toFixed(1)}%</div>
      <div class="verdict">${buy ? "Recommendation: BUY" : "Recommendation: WALK AWAY"}</div>
    </div>`;
  if (window.sim && sim.event) sim.event("inference", { price: infPrice, color: infColor, score: infResult.prediction });
  update();
}

const sim = createSim({
  onInit({ theme, reducedMotion }) {
    REDUCE = REDUCE || reducedMotion;
    applyTheme(theme);
    initDOM();
    update();
  }
});
window.sim = sim;

new ResizeObserver(() => reportSize()).observe(document.body);

// Fallback for standalone preview (no host init)
setTimeout(() => {
  if (!sim.isInitialized() && !document.getElementById("graph")) { initDOM(); update(); }
}, 300);
