// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// Rails or a driver. The same order-support request runs on two copies of one small town
// at once. On the left a tram follows rails the designer laid in advance: every branch is
// wired, and a model only drafts the reply. On the right a car has a model at the wheel:
// at each junction it reads the last result and picks the next desk. With the expected
// tool result both reach the same outcome, and the tram burns less fuel (model calls).
// With an unexpected result (a partly shipped order) the tram can only take the rail the
// designer left for "anything else"; the driver picks a street nobody mapped. The
// driver's choices are a scripted teaching fixture: a real model could choose differently,
// which is the predictability that autonomy costs. Deterministic.

const app = document.getElementById("app");

const REQUEST = "Please send order A1234 to my new address: 12 Rue Victor Hugo, Lyon.";
const RESULTS = {
  expected: { label: "As expected: still processing", json: '{"status": "processing"}' },
  unexpected: { label: "Surprise: partly shipped", json: '{"status": "partially_shipped", parts: A1234-1 shipped, A1234-2 processing}' },
};

// Town layout, in each map's own coordinates (360 x 300).
const NODES = {
  inbox: { x: 56, y: 56, label: "Inbox", sub: "the request" },
  order: { x: 196, y: 56, label: "Order desk", sub: "get_order_status" },
  address: { x: 300, y: 168, label: "Address desk", sub: "update_address" },
  help: { x: 196, y: 252, label: "Help desk", sub: "handoff_to_human" },
  reply: { x: 56, y: 252, label: "Reply", sub: "answer the user" },
};
const MAPS = { tram: { x: 12, title: "Fixed workflow: the designer laid the rails" }, car: { x: 388, title: "Agent: the model drives" } };
// The rails the designer wired, with their switch labels.
const RAILS = [
  ["inbox", "order", ""],
  ["order", "address", "processing"],
  ["order", "help", "anything else"],
  ["address", "reply", ""],
  ["help", "reply", ""],
];

// Each step: { at: node, text, model: true if it costs a model call, think: driver's thought }.
function runs(result) {
  const tram = result === "expected"
    ? [
      { at: "inbox", text: "The request arrives." },
      { at: "order", text: 'Runs get_order_status: {"status": "processing"}.' },
      { at: "address", text: 'The switch reads "processing", so the wired rail runs update_address.' },
      { at: "reply", text: "A model drafts the reply the workflow asked for: “Done: order A1234 will go to 12 Rue Victor Hugo, Lyon.”", model: true },
    ]
    : [
      { at: "inbox", text: "The request arrives." },
      { at: "order", text: 'Runs get_order_status: "partially_shipped".' },
      { at: "help", text: '"partially_shipped" matches no switch the designer wired, so the tram takes the "anything else" rail: handoff_to_human.' },
      { at: "reply", text: "A model drafts the reply the workflow asked for: “I've passed your request to a colleague.”", model: true },
    ];
  const car = result === "expected"
    ? [
      { at: "inbox", text: "The request arrives." },
      { at: "inbox", text: "Model call 1 chooses the first step.", model: true, think: "Check the order first." },
      { at: "order", text: 'Runs get_order_status: {"status": "processing"}.' },
      { at: "order", text: "Model call 2 reads the result and chooses update_address.", model: true, think: "Not shipped yet: change the address." },
      { at: "address", text: 'Runs update_address(order_id="A1234"): {"status": "updated"}.' },
      { at: "reply", text: "Model call 3 decides it is done: “Done: order A1234 will go to 12 Rue Victor Hugo, Lyon.”", model: true, think: "Done. Tell the user." },
    ]
    : [
      { at: "inbox", text: "The request arrives." },
      { at: "inbox", text: "Model call 1 chooses the first step.", model: true, think: "Check the order first." },
      { at: "order", text: 'Runs get_order_status: one part shipped, one still processing.' },
      { at: "order", text: 'Model call 2 chooses update_address for part A1234-2 only, a step nobody wired.', model: true, think: "One part left already. Redirect the other one." },
      { at: "address", text: 'Runs update_address(order_id="A1234-2"): {"status": "updated"}.' },
      { at: "reply", text: "Model call 3: “Part A1234-2 will go to your new address. Part A1234-1 already left for the old one. Shall I pass it to a colleague?”", model: true, think: "Explain both parts. Offer help." },
    ];
  return { tram, car };
}
const OUTCOMES = {
  expected: { tram: "Address changed", car: "Address changed" },
  unexpected: { tram: "Handed to a person; nothing changed", car: "Unshipped part redirected; user asked about the rest" },
};
const PREDICT = {
  tram: { address: "Changes the address", help: "Hands it to a person", stuck: "Gets stuck" },
  car: { address: "Redirects the unshipped part", help: "Hands it to a person", stuck: "Gets stuck" },
};
const RIGHT = { tram: "help", car: "address" };

let result = "unexpected";
let step = 0; // index into the longer run; both vehicles advance together
let timer = null;
let predicted = { tram: null, car: null };
let reported = false;
let reduced = false;
let els = {};

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

function lastIndex() {
  const r = runs(result);
  return Math.max(r.tram.length, r.car.length) - 1;
}

function done() {
  return step >= lastIndex();
}

function modelCalls(list, upTo) {
  return list.slice(0, upTo + 1).filter((s) => s.model).length;
}

// ---- Drawing --------------------------------------------------------------------------------

function nodeG(mx, key) {
  const n = NODES[key];
  return `<g class="desk" id="${mx === MAPS.tram.x ? "t" : "c"}-${key}" transform="translate(${mx + n.x},${n.y + 40})">
    <rect x="-56" y="-22" width="112" height="44" rx="8"/>
    <text class="dl" y="-3">${n.label}</text>
    <text class="ds" y="12">${n.sub}</text>
  </g>`;
}

function line(mx, a, b, cls) {
  const p = NODES[a];
  const q = NODES[b];
  return `<line class="${cls}" x1="${mx + p.x}" y1="${p.y + 40}" x2="${mx + q.x}" y2="${q.y + 40}"/>`;
}

function buildScene() {
  const tx = MAPS.tram.x;
  const cx = MAPS.car.x;
  const keys = Object.keys(NODES);
  const streets = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) streets.push(line(cx, keys[i], keys[j], "street"));
  const rails = RAILS.map(([a, b, l]) => {
    const p = NODES[a];
    const q = NODES[b];
    const mid = { x: tx + (p.x + q.x) / 2, y: (p.y + q.y) / 2 + 40 };
    return `${line(tx, a, b, "rail")}${line(tx, a, b, "ties")}${l ? `<g class="switch" transform="translate(${mid.x},${mid.y})"><rect x="-44" y="-10" width="88" height="20" rx="10"/><text y="4">${l}</text></g>` : ""}`;
  }).join("");
  els.svg.innerHTML = `
    <rect class="map" x="${tx - 6}" y="4" width="364" height="336" rx="12"/>
    <rect class="map" x="${cx - 6}" y="4" width="364" height="336" rx="12"/>
    <text class="mt" x="${tx + 176}" y="26">${MAPS.tram.title}</text>
    <text class="mt" x="${cx + 176}" y="26">${MAPS.car.title}</text>
    ${rails}
    ${streets.join("")}
    ${keys.map((k) => nodeG(tx, k)).join("")}
    ${keys.map((k) => nodeG(cx, k)).join("")}
    <g id="tram" class="vehicle tram"><rect x="-22" y="-11" width="44" height="22" rx="6"/><text y="4">tram</text></g>
    <g id="car" class="vehicle car"><rect x="-20" y="-11" width="40" height="22" rx="11"/><text y="4">car</text></g>
    <g id="bubble" class="bubble"><rect id="bubble-r" x="-118" width="236" height="30" rx="12"/><path id="bubble-p"/><text id="bubble-t"></text></g>
    ${["tram", "car"].map((v) => `<g class="fuel" transform="translate(${MAPS[v].x + 8},${352})"><text class="fl" x="0" y="0">Model calls</text>${[0, 1, 2].map((i) => `<rect id="${v}-f${i}" x="${84 + i * 26}" y="-12" width="20" height="14" rx="3"/>`).join("")}<text class="fo" id="${v}-out" x="0" y="20"></text></g>`).join("")}`;
  els.tram = els.svg.querySelector("#tram");
  els.car = els.svg.querySelector("#car");
  els.bubble = els.svg.querySelector("#bubble");
  els.bubbleT = els.svg.querySelector("#bubble-t");
}

function place(el, mx, key, dy) {
  const n = NODES[key];
  el.setAttribute("transform", `translate(${mx + n.x},${n.y + 40 + dy})`);
}

function drawScene() {
  const r = runs(result);
  const ti = Math.min(step, r.tram.length - 1);
  const ci = Math.min(step, r.car.length - 1);
  const ts = r.tram[ti];
  const cs = r.car[ci];
  place(els.tram, MAPS.tram.x, ts.at, -32);
  place(els.car, MAPS.car.x, cs.at, -32);
  // Light the desks each vehicle has visited.
  for (const [prefix, list, idx] of [["t", r.tram, ti], ["c", r.car, ci]]) {
    const seen = new Set(list.slice(0, idx + 1).map((s) => s.at));
    for (const k of Object.keys(NODES)) els.svg.querySelector(`#${prefix}-${k}`).setAttribute("class", `desk${seen.has(k) ? " seen" : ""}${list[idx].at === k ? " here" : ""}`);
  }
  // Rails the tram has run on.
  const path = r.tram.slice(0, ti + 1).map((s) => s.at);
  els.svg.querySelectorAll(".switch").forEach((g, i) => {
    const [a, b] = RAILS.filter((x) => x[2])[i];
    g.setAttribute("class", `switch${path.includes(a) && path.includes(b) ? " taken" : ""}`);
  });
  if (cs.think) {
    const n = NODES[cs.at];
    const below = n.y < 100; // top-row desks: the thought goes under the desk, clear of the title
    const bx = Math.max(MAPS.car.x + 122, Math.min(MAPS.car.x + n.x, MAPS.car.x + 230));
    const by = below ? n.y + 40 + 26 : n.y + 40 - 46;
    els.bubble.setAttribute("transform", `translate(${bx},${by})`);
    const tail = MAPS.car.x + n.x - bx;
    els.svg.querySelector("#bubble-r").setAttribute("y", below ? "8" : "-38");
    els.svg.querySelector("#bubble-p").setAttribute("d", below ? `M${tail - 6} 9 L${tail} 0 L${tail + 6} 9 Z` : `M${tail - 6} -9 L${tail} 0 L${tail + 6} -9 Z`);
    els.bubbleT.setAttribute("y", below ? "27" : "-19");
    els.bubbleT.textContent = cs.think;
    els.bubble.setAttribute("opacity", "1");
  } else els.bubble.setAttribute("opacity", "0");
  for (const [v, list, idx] of [["tram", r.tram, ti], ["car", r.car, ci]]) {
    const n = modelCalls(list, idx);
    for (let i = 0; i < 3; i++) els.svg.querySelector(`#${v}-f${i}`).setAttribute("class", i < n ? "on" : "");
    const finished = idx === list.length - 1;
    els.svg.querySelector(`#${v}-out`).textContent = finished ? OUTCOMES[result][v] : "";
  }
  els.svg.setAttribute("aria-label", `Two copies of the same town. The tram, on the designer's rails, is at the ${NODES[ts.at].label}. The car, driven by the model, is at the ${NODES[cs.at].label}.`);
}

// ---- Controls -------------------------------------------------------------------------------

function build() {
  app.innerHTML = `
    <details class="panel predict" open>
      <summary class="q"><strong>Predict first.</strong> The request: <em>“${esc(REQUEST)}”</em> The order turns out to be partly shipped. What does each one do?</summary>
      ${["tram", "car"].map((v) => `<div class="chips" role="group" aria-label="${v === "tram" ? "The fixed workflow" : "The agent"}"><span class="seglabel">${v === "tram" ? "Workflow (tram)" : "Agent (car)"}</span>${Object.entries(PREDICT[v]).map(([k, l]) => `<button type="button" class="chip" data-v="${v}" data-predict="${k}" aria-pressed="false">${l}</button>`).join("")}</div>`).join("")}
      <p class="verdict" id="verdict"></p>
    </details>
    <div class="panel stage">
      <div class="scroll" tabindex="0" role="region" aria-label="The two towns"><svg id="svg" viewBox="0 0 760 384" role="img"></svg></div>
      <div class="caption" id="caption" role="status"></div>
      <div class="controls">
        <div class="seg" role="group" aria-label="What get_order_status returns"><span class="seglabel">get_order_status returns</span>
          ${Object.entries(RESULTS).map(([k, v]) => `<button type="button" class="pill" data-result="${k}" aria-pressed="false">${v.label}</button>`).join("")}
        </div>
        <div class="buttons">
          <button type="button" id="step" class="primary">Step</button>
          <button type="button" id="auto">Auto</button>
          <button type="button" id="reset">Reset</button>
        </div>
      </div>
    </div>
    <p class="legend">The driver's choices are a scripted teaching fixture; a real model may choose differently on another run. Fuel is model calls.</p>`;
  els = {};
  for (const id of ["svg", "caption", "verdict", "step", "auto", "reset"]) els[id] = app.querySelector(`#${id}`);
  buildScene();
  app.querySelectorAll("[data-predict]").forEach((b) => b.addEventListener("click", () => {
    predicted[b.dataset.v] = b.dataset.predict;
    sim.event("predicted", { vehicle: b.dataset.v, prediction: b.dataset.predict });
    render();
  }));
  app.querySelectorAll("[data-result]").forEach((b) => b.addEventListener("click", () => { result = b.dataset.result; reset(); render(); }));
  els.step.addEventListener("click", () => { stopAuto(); advance(); render(); });
  els.auto.addEventListener("click", () => { if (timer) stopAuto(); else startAuto(); render(); });
  els.reset.addEventListener("click", () => { reset(); render(); });
}

function reset() {
  stopAuto();
  step = 0;
}

function advance() {
  if (done()) return;
  step += 1;
  if (done()) {
    sim.event("run-finished", { result });
    if (result === "unexpected" && !reported) {
      reported = true;
      sim.checkpoint("observe-who-decides");
    }
  }
}

function stopAuto() {
  if (timer) clearInterval(timer);
  timer = null;
}

function startAuto() {
  if (done()) return;
  timer = setInterval(() => {
    advance();
    if (done()) stopAuto();
    render();
  }, reduced ? 600 : 1100);
}

function verdictText() {
  if (result !== "unexpected" || !done() || (!predicted.tram && !predicted.car)) return "";
  const part = (v, name) => predicted[v] ? `${name}: ${predicted[v] === RIGHT[v] ? "right" : `not quite (it ${v === "tram" ? "hands it to a person" : "redirects the unshipped part"})`}` : "";
  return [part("tram", "Workflow"), part("car", "Agent")].filter(Boolean).join(" · ") + ". The workflow could only take the rail its designer left; the agent chose a step nobody wired.";
}

function render() {
  const pressed = (sel, on) => app.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(on(b))));
  pressed("[data-predict]", (b) => predicted[b.dataset.v] === b.dataset.predict);
  pressed("[data-result]", (b) => b.dataset.result === result);
  drawScene();
  const r = runs(result);
  const ti = Math.min(step, r.tram.length - 1);
  const ci = Math.min(step, r.car.length - 1);
  const tDone = step >= r.tram.length - 1;
  els.caption.innerHTML = `<p><strong>Tram:</strong> ${esc(tDone && step > ti ? `Arrived. ${OUTCOMES[result].tram}, with ${modelCalls(r.tram, ti)} model call.` : r.tram[ti].text)}</p>
    <p><strong>Car:</strong> ${esc(r.car[ci].text)}</p>
    ${done() ? `<p class="sum">${result === "expected" ? "Same outcome. The rails used 1 model call, the driver 3: when the path is known, autonomy only costs fuel." : "The rails had no switch for a partly shipped order, so the tram fell through to the help desk. The driver adapted, with a step nobody tested."}</p>` : ""}`;
  els.auto.textContent = timer ? "Pause" : "Auto";
  els.verdict.textContent = verdictText();
  reportSize();
}

function readProps(props) {
  if (props && RESULTS[props.result]) result = props.result;
}

document.addEventListener("visibilitychange", () => { if (document.hidden && timer) { stopAuto(); render(); } });

const sim = createSim({
  onInit({ props, theme, reducedMotion }) {
    applyTheme(theme);
    readProps(props);
    reduced = !!reducedMotion;
    if (reduced) document.documentElement.classList.add("reduced");
    build();
    render();
  },
});

// Fallback for opening the bundle directly (no host init).
setTimeout(() => {
  if (!sim.isInitialized() && app.childElementCount === 0) {
    build();
    render();
  }
}, 300);
