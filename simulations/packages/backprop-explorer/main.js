// createSim is a global from sim-sdk.js (classic script). A step-by-step walkthrough of how a small
// network (2 inputs -> 3 hidden -> 1 output) learns by REAL backpropagation: the network, the forward
// pass, the error, the blame signal (delta) flowing BACKWARD, the weight update, training, and
// inference. Connection thickness = weight magnitude (what weights "mean"). Theme + reduced-motion
// aware, no CDNs.

const app = document.getElementById("app");

const DATA = [
  { id: 1, price: 9, color: 8, target: 0 },
  { id: 2, price: 3, color: 4, target: 1 },
  { id: 3, price: 4, color: 9, target: 1 },
  { id: 4, price: 8, color: 2, target: 0 },
  { id: 5, price: 2, color: 8, target: 1 }
];
const LR = 0.5;

const POS = {
  price: { cx: 70, cy: 90 }, color: { cx: 70, cy: 190 },
  h1: { cx: 300, cy: 60 }, h2: { cx: 300, cy: 140 }, h3: { cx: 300, cy: 220 },
  output: { cx: 540, cy: 140 }, optimizer: { cx: 690, cy: 140 }
};

// 9 forward connections: id, from, to, weight-accessor, color token, marker
const CONNS = [
  { id: "p1", a: "price", b: "h1", col: "--bad", mk: "m-red" },
  { id: "p2", a: "price", b: "h2", col: "--bad", mk: "m-red" },
  { id: "p3", a: "price", b: "h3", col: "--bad", mk: "m-red" },
  { id: "c1", a: "color", b: "h1", col: "--primary", mk: "m-blue" },
  { id: "c2", a: "color", b: "h2", col: "--primary", mk: "m-blue" },
  { id: "c3", a: "color", b: "h3", col: "--primary", mk: "m-blue" },
  { id: "o1", a: "h1", b: "output", col: "--neuron", mk: "m-purple" },
  { id: "o2", a: "h2", b: "output", col: "--neuron", mk: "m-purple" },
  { id: "o3", a: "h3", b: "output", col: "--neuron", mk: "m-purple" }
];

const STEPS = [
  { t: "The network", d: "A network is just <b>layers of neurons</b>: 2 inputs (price, color) → 3 hidden neurons → 1 output. Every line is a <b>weight</b> — how strongly one neuron listens to another. <b>Thicker line = bigger weight.</b> All those numbers together <i>are</i> the model." },
  { t: "Forward pass", d: "To make a guess, data flows <b>left → right</b>. Each neuron takes a weighted sum of its inputs, squashes it to 0–1 (sigmoid), and passes it on. Trace one car below — inputs become hidden activations become a final <b>guess</b>." },
  { t: "The error", d: "Compare the guess to the truth (buy=1 / walk=0). The gap is the <b>error</b>; averaged and squared over all cars it's the <b>loss</b> — one number for how wrong the whole network is." },
  { t: "Backprop — blame flows back", d: "Here's the trick. The output's error becomes a <b>blame signal (δ)</b> that flows <b>backward</b> along the orange paths. Each hidden neuron gets a share of the blame <b>scaled by its weight to the output</b> — the louder it spoke, the more it's blamed." },
  { t: "Weight update", d: "Every weight now steps <b>down its own gradient</b> (its blame × the input that drove it). Big contributors get big corrections; bystanders barely move. That's one learning step. <b>Step</b> it and watch the weights and δ change." },
  { t: "Train the loop", d: "Repeat forward → error → backprop → update, thousands of times. <b>Auto Train</b> and watch the loss fall, the weights settle, and the points on the graph flip to their correct colors as the network learns the rule." },
  { t: "Inference", d: "Trained, it just predicts: one <b>forward pass</b> on a new car, no backprop. Stacking neurons like this is what lets a network bend a <b>curved</b> boundary a single neuron never could." }
];

// Weights (fixed init -> deterministic first paint; Reset randomizes)
let wh1 = { w1: 0.6, w2: -0.5, b: 0.1 };
let wh2 = { w1: -0.4, w2: 0.7, b: -0.2 };
let wh3 = { w1: 0.3, w2: 0.4, b: -0.1 };
let wo = { w1: 0.5, w2: -0.6, w3: 0.4, b: 0.0 };
let deltas = { o: 0, h1: 0, h2: 0, h3: 0 };

let step = 0, epoch = 0, sampleIdx = 4;
let isTraining = false, converged = false, observed = false;
let infPrice = 3, infColor = 8, infResult = null, timer = null;
let REDUCE = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const dsig = (a) => a * (1 - a);

function forward(price, color) {
  const np = price / 10, nc = color / 10;
  const a_h1 = sigmoid(np * wh1.w1 + nc * wh1.w2 + wh1.b);
  const a_h2 = sigmoid(np * wh2.w1 + nc * wh2.w2 + wh2.b);
  const a_h3 = sigmoid(np * wh3.w1 + nc * wh3.w2 + wh3.b);
  const a_o = sigmoid(a_h1 * wo.w1 + a_h2 * wo.w2 + a_h3 * wo.w3 + wo.b);
  return { a_h1, a_h2, a_h3, a_o };
}

function evaluate() {
  let total = 0;
  const predictions = DATA.map(car => {
    const { a_o } = forward(car.price, car.color);
    total += (a_o - car.target) ** 2;
    return { id: car.id, prediction: a_o };
  });
  return { predictions, meanLoss: total / DATA.length };
}

function trainStep() {
  const og = { w1: 0, w2: 0, w3: 0, b: 0 };
  const g1 = { w1: 0, w2: 0, b: 0 }, g2 = { w1: 0, w2: 0, b: 0 }, g3 = { w1: 0, w2: 0, b: 0 };
  let dO = 0, d1 = 0, d2 = 0, d3 = 0;
  DATA.forEach(car => {
    const np = car.price / 10, nc = car.color / 10;
    const { a_h1, a_h2, a_h3, a_o } = forward(car.price, car.color);
    const eo = a_o - car.target;              // output blame
    dO += eo;
    og.w1 += eo * a_h1; og.w2 += eo * a_h2; og.w3 += eo * a_h3; og.b += eo;
    const dh1 = eo * wo.w1 * dsig(a_h1);       // blame flows back, scaled by weight to output
    const dh2 = eo * wo.w2 * dsig(a_h2);
    const dh3 = eo * wo.w3 * dsig(a_h3);
    d1 += dh1; d2 += dh2; d3 += dh3;
    g1.w1 += dh1 * np; g1.w2 += dh1 * nc; g1.b += dh1;
    g2.w1 += dh2 * np; g2.w2 += dh2 * nc; g2.b += dh2;
    g3.w1 += dh3 * np; g3.w2 += dh3 * nc; g3.b += dh3;
  });
  const n = DATA.length;
  deltas = { o: dO / n, h1: d1 / n, h2: d2 / n, h3: d3 / n };
  wo = { w1: wo.w1 - LR * og.w1 / n, w2: wo.w2 - LR * og.w2 / n, w3: wo.w3 - LR * og.w3 / n, b: wo.b - LR * og.b / n };
  wh1 = { w1: wh1.w1 - LR * g1.w1 / n, w2: wh1.w2 - LR * g1.w2 / n, b: wh1.b - LR * g1.b / n };
  wh2 = { w1: wh2.w1 - LR * g2.w1 / n, w2: wh2.w2 - LR * g2.w2 / n, b: wh2.b - LR * g2.b / n };
  wh3 = { w1: wh3.w1 - LR * g3.w1 / n, w2: wh3.w2 - LR * g3.w2 / n, b: wh3.b - LR * g3.b / n };
  epoch++;
}

function connWeight(id) {
  return { p1: wh1.w1, p2: wh2.w1, p3: wh3.w1, c1: wh1.w2, c2: wh2.w2, c3: wh3.w2, o1: wo.w1, o2: wo.w2, o3: wo.w3 }[id];
}

function applyTheme(t) { if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
function reportSize() { requestAnimationFrame(() => { if (window.sim && sim.resize) sim.resize(document.body.scrollHeight + 8); }); }

function initDOM() {
  const stepsHtml = STEPS.map((s, i) => `<button class="step-btn ${i === step ? "active" : ""}" data-s="${i}" ${i === step ? 'aria-current="step"' : ""}><span>${s.t}</span><span class="step-num">${i}</span></button>`).join("");

  // Build the static diagram once (so the backprop dashes can keep flowing across ticks).
  const P = POS;
  let conns = "";
  CONNS.forEach(c => {
    const a = P[c.a], b = P[c.b], mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
    const ang = Math.atan2(b.cy - a.cy, b.cx - a.cx) * 180 / Math.PI;
    conns += `<g class="conn-g" id="g-${c.id}"><line class="fwd" id="ln-${c.id}" x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}" stroke="var(${c.col})" stroke-width="2" marker-end="url(#${c.mk})"/><text id="tx-${c.id}" x="${mx}" y="${my}" fill="var(${c.col})" font-size="10" font-weight="bold" text-anchor="middle" transform="rotate(${ang.toFixed(0)},${mx},${my})" dy="-3"></text></g>`;
  });
  // Backprop arrows: optimizer->output, output->h1/h2/h3 (pointing backward)
  const bpA = (tg, src) => `<line class="bp" x1="${src.cx}" y1="${src.cy}" x2="${tg.cx}" y2="${tg.cy}" stroke="var(--warn)" stroke-width="1.6" opacity="0.6" marker-end="url(#m-orange)"/>`;
  const bp = `<g class="bp-g" id="bpg">${bpA(P.output, P.optimizer)}${bpA(P.h1, P.output)}${bpA(P.h2, P.output)}${bpA(P.h3, P.output)}</g>`;
  // delta badge for a node
  const dBadge = (id, p) => `<g id="dg-${id}" opacity="0"><rect x="${p.cx - 33}" y="${p.cy - 47}" width="66" height="18" rx="4" fill="var(--inset)" stroke="var(--warn)" stroke-width="1"/><text id="dt-${id}" x="${p.cx}" y="${p.cy - 34}" text-anchor="middle" fill="var(--warn)" font-size="10" font-weight="bold"></text></g>`;
  const node = (p, label, colVar, biasId) => `<circle cx="${p.cx}" cy="${p.cy}" r="24" fill="var(--inset)" stroke="var(${colVar})" stroke-width="3"/><text x="${p.cx}" y="${p.cy + 3}" text-anchor="middle" fill="var(${colVar})" font-size="13" font-weight="bold">${label}</text>${biasId ? `<text id="${biasId}" x="${p.cx}" y="${p.cy + 16}" text-anchor="middle" fill="var(--muted)" font-size="9"></text>` : ""}`;

  app.innerHTML = `
    <div class="layout-grid">
      <div class="sidebar">
        <nav class="steps-nav" aria-label="Steps">${stepsHtml}</nav>
        <div class="panel explain"><div class="e-title" id="e-title"></div><div class="e-desc" id="e-desc"></div></div>
        <div id="controls" class="controls"></div>
        <div class="metrics">
          <div class="m-card"><div class="m-k">Epochs run</div><div class="m-v" id="m-ep">0</div></div>
          <div class="m-card"><div class="m-k">Mean loss</div><div class="m-v loss" id="m-loss">—</div></div>
        </div>
        <div class="converged" id="converged">🎉 <b>Converged</b> — loss below 0.01. The trained weights are the model.</div>
      </div>

      <div class="main-content">
        <div class="panel diagram">
          <h2 id="diag-h">Network</h2>
          <svg viewBox="0 0 760 280" role="img" aria-label="a 2-3-1 neural network: price and color inputs, three hidden neurons, one output, with backpropagation arrows">
            <defs>
              <marker id="m-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--bad)"/></marker>
              <marker id="m-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--primary)"/></marker>
              <marker id="m-purple" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--neuron)"/></marker>
              <marker id="m-orange" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--warn)"/></marker>
            </defs>
            <g id="fwdg">${conns}</g>
            ${bp}
            <line id="loss-line" x1="${P.output.cx + 24}" y1="${P.output.cy}" x2="${P.optimizer.cx - 50}" y2="${P.optimizer.cy}" stroke="var(--warn)" stroke-width="2" marker-end="url(#m-orange)"/>
            <rect x="${P.optimizer.cx - 50}" y="${P.optimizer.cy - 28}" width="100" height="56" rx="8" fill="var(--inset)" stroke="var(--warn)" stroke-width="3"/>
            <text x="${P.optimizer.cx}" y="${P.optimizer.cy - 4}" text-anchor="middle" fill="var(--warn)" font-size="13" font-weight="bold">Optimizer</text>
            <text id="opt-loss" x="${P.optimizer.cx}" y="${P.optimizer.cy + 14}" text-anchor="middle" fill="var(--fg)" font-size="11"></text>
            ${dBadge("h1", P.h1)}${dBadge("h2", P.h2)}${dBadge("h3", P.h3)}${dBadge("o", P.output)}
            ${node(P.price, "Price", "--bad")}${node(P.color, "Color", "--primary")}
            ${node(P.h1, "H1", "--neuron", "bx-h1")}${node(P.h2, "H2", "--neuron", "bx-h2")}${node(P.h3, "H3", "--neuron", "bx-h3")}
            ${node(P.output, "Out", "--good", "bx-o")}
          </svg>
        </div>
        <div class="panel" id="context"></div>
      </div>
    </div>`;

  app.querySelectorAll(".step-btn").forEach(btn => btn.addEventListener("click", () => setStep(+btn.dataset.s)));
  update();
}

function setStep(s) {
  if (isTraining) stopTrain();
  step = s;
  if (s === 6 && epoch === 0) { /* allow inference even untrained, but nudge */ }
  if (s === 6 && !observed && window.sim) { observed = true; sim.checkpoint("observe-backprop"); }
  if (window.sim && sim.event) sim.event("step", { step: s });
  update();
}

function buildControls() {
  const c = document.getElementById("controls");
  if (step === 1 || step === 2) {
    c.innerHTML = `<div class="panel" style="padding:12px"><div class="m-k" style="margin-bottom:8px">Trace which car</div><div class="btn-row" id="samp"></div></div>`;
    const sr = document.getElementById("samp");
    DATA.forEach((car, i) => {
      const bt = document.createElement("button");
      bt.className = "btn " + (i === sampleIdx ? "step" : "reset");
      bt.textContent = car.id;
      bt.style.padding = "8px 0";
      bt.addEventListener("click", () => { sampleIdx = i; update(); });
      sr.appendChild(bt);
    });
  } else if (step === 3 || step === 4) {
    c.innerHTML = `<div class="btn-row"><button class="btn step" id="b-step">Step (+1 epoch)</button><button class="btn reset" id="b-reset">Reset</button></div>`;
    document.getElementById("b-step").addEventListener("click", () => { if (!converged) { trainStep(); update(); } });
    document.getElementById("b-reset").addEventListener("click", reset);
  } else if (step === 5) {
    c.innerHTML = `<div class="btn-row"><button class="btn step" id="b-step">Step</button><button class="btn train" id="b-train">Auto Train</button></div><button class="btn reset" id="b-reset">Reset</button>`;
    document.getElementById("b-step").addEventListener("click", () => { if (!converged) { trainStep(); update(); } });
    document.getElementById("b-train").addEventListener("click", toggleTrain);
    document.getElementById("b-reset").addEventListener("click", reset);
  } else if (step === 6) {
    c.innerHTML = `<div class="inf-grid"><div><label for="ip">Price (1–10)</label><input type="number" id="ip" min="1" max="10" value="${infPrice}"></div><div><label for="ic">Color (1–10)</label><input type="number" id="ic" min="1" max="10" value="${infColor}"></div></div><button class="btn run" id="b-infer" style="margin-top:10px">Run inference</button>`;
    document.getElementById("ip").addEventListener("input", e => { infPrice = clamp(+e.target.value); });
    document.getElementById("ic").addEventListener("input", e => { infColor = clamp(+e.target.value); });
    document.getElementById("b-infer").addEventListener("click", runInference);
  } else {
    c.innerHTML = `<button class="btn reset" id="b-reset">Reset network</button>`;
    document.getElementById("b-reset").addEventListener("click", reset);
  }
}
function clamp(v) { return Math.max(1, Math.min(10, isFinite(v) ? v : 1)); }

function graphSVG(predictions) {
  let grid = "";
  for (let i = 0; i <= 10; i++) {
    grid += `<line x1="${i * 10}" y1="0" x2="${i * 10}" y2="100" stroke="var(--border)" stroke-width="0.4"/>`;
    grid += `<line x1="0" y1="${i * 10}" x2="100" y2="${i * 10}" stroke="var(--border)" stroke-width="0.4"/>`;
  }
  let pts = "";
  DATA.forEach(car => {
    const x = car.price * 10, y = 100 - car.color * 10;
    const pred = predictions.find(p => p.id === car.id).prediction;
    const pc = pred > 0.5 ? "var(--good)" : "var(--bad)";
    const tc = car.target === 1 ? "var(--good)" : "var(--bad)";
    const ring = (step === 1 || step === 2) && DATA[sampleIdx].id === car.id ? `<circle cx="${x}" cy="${y}" r="6" fill="none" stroke="var(--warn)" stroke-width="1.5"/>` : "";
    pts += ring + `<circle cx="${x}" cy="${y}" r="3.6" fill="none" stroke="${tc}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="2" fill="${pc}"/>`;
  });
  let inf = "";
  if (step === 6 && infResult) {
    const ix = infPrice * 10, iy = 100 - infColor * 10;
    inf = `<circle cx="${ix}" cy="${iy}" r="5" fill="none" stroke="var(--warn)" stroke-width="2"/><circle cx="${ix}" cy="${iy}" r="2.6" fill="var(--warn)"/>`;
  }
  return `<svg viewBox="0 0 100 100" role="img" aria-label="decision graph: cars by price and color, colored by the network's prediction">${grid}${pts}${inf}</svg>`;
}

function buildContext(predictions) {
  const ctx = document.getElementById("context");
  if (step === 1 || step === 2) {
    const car = DATA[sampleIdx];
    const f = forward(car.price, car.color);
    const err = f.a_o - car.target;
    ctx.innerHTML = `<h2>Trace — car ${car.id} (price ${car.price}, color ${car.color})</h2>
      <div class="trace">
        <div class="tr"><span class="lab">Inputs (normalized)</span><span class="val">[${(car.price / 10).toFixed(1)}, ${(car.color / 10).toFixed(1)}]</span></div>
        <div class="tr"><span class="lab">Hidden activations H1·H2·H3</span><span class="val">${f.a_h1.toFixed(2)} · ${f.a_h2.toFixed(2)} · ${f.a_h3.toFixed(2)}</span></div>
        <div class="tr out"><span class="lab">Output guess (0–1)</span><span class="val">${f.a_o.toFixed(2)}</span></div>
        <div class="tr"><span class="lab">Target (truth)</span><span class="val">${car.target}${car.target ? " (buy)" : " (walk)"}</span></div>
        ${step === 2 ? `<div class="tr err"><span class="lab">Error (guess − truth)</span><span class="val">${err.toFixed(2)}</span></div>` : ""}
      </div>`;
  } else {
    ctx.innerHTML = `<h2>Decision graph</h2><div class="graph-box"><div id="graph">${graphSVG(predictions)}</div><div class="axlabel x">Price →</div><div class="axlabel y">Color →</div></div>
      <div class="legend"><div class="it"><span class="dot" style="background:var(--good)"></span>Buy</div><div class="it"><span class="dot" style="background:var(--bad)"></span>Walk</div>${step === 6 ? '<div class="it"><span class="dot" style="background:var(--warn)"></span>New car</div>' : ""}</div>
      <p class="note">Filled dot = the network's current guess; ring = the true label. As it trains, fills flip to match rings.</p>`;
  }
}

function updateDiagram() {
  // forward connections: thickness + opacity + label by weight
  CONNS.forEach(c => {
    const w = connWeight(c.id);
    document.getElementById("ln-" + c.id).setAttribute("stroke-width", Math.min(6.5, Math.max(1, Math.abs(w) * 2.4)).toFixed(1));
    document.getElementById("g-" + c.id).setAttribute("opacity", Math.max(0.25, Math.min(1, Math.abs(w) / 2.5)).toFixed(2));
    document.getElementById("tx-" + c.id).textContent = w.toFixed(2);
  });
  document.getElementById("bx-h1").textContent = "b " + wh1.b.toFixed(2);
  document.getElementById("bx-h2").textContent = "b " + wh2.b.toFixed(2);
  document.getElementById("bx-h3").textContent = "b " + wh3.b.toFixed(2);
  document.getElementById("bx-o").textContent = "b " + wo.b.toFixed(2);
  document.getElementById("opt-loss").textContent = "loss " + evaluate().meanLoss.toFixed(2);

  // backprop visible on steps >= 3; delta badges too (once trained at least once)
  const showBP = step >= 3 && step <= 5;
  document.getElementById("bpg").style.opacity = showBP ? "1" : "0.12";
  document.getElementById("loss-line").style.opacity = showBP ? "1" : "0.3";
  app.querySelectorAll(".bp").forEach(l => l.classList.toggle("train", isTraining));
  [["h1", deltas.h1], ["h2", deltas.h2], ["h3", deltas.h3], ["o", deltas.o]].forEach(([k, v]) => {
    document.getElementById("dg-" + k).setAttribute("opacity", showBP && epoch > 0 ? "1" : "0");
    document.getElementById("dt-" + k).textContent = "δ " + v.toFixed(3);
  });
  // forward pulse only on the forward-pass step
  document.getElementById("fwdg").classList.toggle("flow", step === 1 && !REDUCE);
}

function update() {
  const { predictions, meanLoss } = evaluate();
  app.querySelectorAll(".step-btn").forEach((b, i) => {
    b.classList.toggle("active", i === step);
    if (i === step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
  });
  document.getElementById("e-title").textContent = STEPS[step].t;
  document.getElementById("e-desc").innerHTML = STEPS[step].d;
  document.getElementById("diag-h").textContent = ["The network", "Forward pass", "The error", "Backprop", "Weight update", "Training", "Inference"][step];

  buildControls();
  buildContext(predictions);
  updateDiagram();

  document.getElementById("m-ep").textContent = epoch;
  document.getElementById("m-loss").textContent = meanLoss.toFixed(3);
  document.getElementById("converged").classList.toggle("show", converged);

  if (meanLoss < 0.01 && !converged) {
    converged = true;
    if (isTraining) stopTrain();
    document.getElementById("converged").classList.add("show");
    updateDiagram();
    const tb = document.getElementById("b-train"); if (tb) { tb.textContent = "Re-train"; tb.classList.remove("on"); }
  }
  reportSize();
}

function stopTrain() { clearInterval(timer); timer = null; isTraining = false; const tb = document.getElementById("b-train"); if (tb) { tb.textContent = converged ? "Re-train" : "Auto Train"; tb.classList.remove("on"); } app.querySelectorAll(".bp").forEach(l => l.classList.remove("train")); }

function toggleTrain() {
  const tb = document.getElementById("b-train");
  if (isTraining) { stopTrain(); update(); return; }
  if (converged) { converged = false; epoch = 0; wh1 = { w1: 0.6, w2: -0.5, b: 0.1 }; wh2 = { w1: -0.4, w2: 0.7, b: -0.2 }; wh3 = { w1: 0.3, w2: 0.4, b: -0.1 }; wo = { w1: 0.5, w2: -0.6, w3: 0.4, b: 0.0 }; }
  if (REDUCE) { let i = 0; while (evaluate().meanLoss >= 0.01 && i < 5000) { trainStep(); i++; } update(); return; }
  isTraining = true;
  if (tb) { tb.textContent = "Pause training"; tb.classList.add("on"); }
  update();
  timer = setInterval(() => {
    for (let i = 0; i < 3 && evaluate().meanLoss >= 0.01; i++) trainStep();
    update();
  }, 40);
}

function reset() {
  stopTrain();
  converged = false; epoch = 0; infResult = null; deltas = { o: 0, h1: 0, h2: 0, h3: 0 };
  const r = () => Math.random() * 2 - 1;
  wh1 = { w1: r(), w2: r(), b: r() }; wh2 = { w1: r(), w2: r(), b: r() }; wh3 = { w1: r(), w2: r(), b: r() };
  wo = { w1: r(), w2: r(), w3: r(), b: r() };
  update();
}

function runInference() {
  const { a_o } = forward(infPrice, infColor);
  infResult = { prediction: a_o };
  buildContext(evaluate().predictions);
  if (window.sim && sim.event) sim.event("inference", { price: infPrice, color: infColor, score: a_o });
  // show result under controls
  const buy = a_o > 0.5;
  const c = document.getElementById("controls");
  if (!document.getElementById("inf-out")) { const d = document.createElement("div"); d.id = "inf-out"; d.style.marginTop = "10px"; c.appendChild(d); }
  document.getElementById("inf-out").innerHTML = `<div class="inf-result ${buy ? "buy" : "walk"}"><div class="k">Network score</div><div class="score">${(a_o * 100).toFixed(1)}%</div><div class="verdict">${buy ? "Recommendation: BUY" : "Recommendation: WALK AWAY"}</div></div>`;
  reportSize();
}

const sim = createSim({
  onInit({ theme, reducedMotion }) { REDUCE = REDUCE || reducedMotion; applyTheme(theme); initDOM(); }
});
window.sim = sim;

new ResizeObserver(() => reportSize()).observe(document.body);
setTimeout(() => { if (!sim.isInitialized() && !document.getElementById("e-title")) initDOM(); }, 300);
