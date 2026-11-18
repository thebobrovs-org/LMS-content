// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// From requirement to model choice (topics/agentic-ai/choosing-a-model.mdx). The lesson's
// table (media/agentic-model-choice-table.svg) maps seven requirements to the axis each acts
// on (size, openness, serving) and its usual lean. Here the learner ticks requirements; a wire
// lights from each to its axis and the axis's marker slides to the lean. Two picks that pull
// one axis opposite ways are called out, with the lesson's own way out. Every mapping and
// sentence comes from the lesson or the figure. Deterministic; no motion beyond one short
// transition a tick starts.

const app = document.getElementById("app");

const AXES = {
  size: { title: "Size", hue: "orange", y: 58, left: "Smaller (Flash, Flash-Lite)", right: "Larger (Pro)" },
  open: { title: "Openness", hue: "violet", y: 158, left: "Proprietary (Gemini)", right: "Open weights (Gemma)" },
  serve: { title: "Serving", hue: "teal", y: 258, left: "Managed (MaaS)", right: "Self-deployed (endpoint or GKE)" },
};

// The figure's seven rows, in its order: requirement, axis, which end it pulls.
const REQS = [
  { id: "latency", label: "Low latency, many simple steps", full: "Low latency, or many simple steps", axis: "size", pull: "left",
    why: "Low latency, or many simple steps, acts on size: a smaller model (Flash, Flash-Lite) answers faster and costs less per request." },
  { id: "reasoning", label: "Hard, multi-step reasoning", full: "Hard, multi-step reasoning", axis: "size", pull: "right",
    why: "Hard, multi-step reasoning acts on size: a larger model (Pro) reasons better over long, multi-step problems." },
  { id: "weights", label: "Hold and tune the weights", full: "Hold and tune the weights yourself", axis: "open", pull: "right",
    why: "Holding and tuning the weights yourself acts on openness: open weights (Gemma). Open does not mean self-hosted." },
  { id: "infra", label: "Runs only on infra you operate", full: "Model must run only on infrastructure you operate", axis: "serve", pull: "right",
    why: "A model that must run only on infrastructure you operate acts on serving: self-deployed, on an endpoint or GKE." },
  { id: "eu", label: "Data processed only in the EU", full: "Data must be processed in the EU", axis: "serve", pull: "eu",
    why: "Processing in the EU acts on serving: an EU endpoint, never the global one, if the model's documented processing stays in the EU." },
  { id: "spiky", label: "Small team, spiky traffic", full: "Small team, spiky traffic, nothing to operate", axis: "serve", pull: "left",
    why: "A small team with spiky traffic and nothing to operate acts on serving: model as a service (MaaS), pay as you go." },
  { id: "steady", label: "Steady, very high volume", full: "Steady, very high volume", axis: "serve", pull: "measure",
    why: "Steady, very high volume acts on serving: self-deploying may cost less, but only a measurement tells you. Measure first." },
];
const BY_ID = Object.fromEntries(REQS.map((r) => [r.id, r]));
const SCENARIO = ["latency", "eu", "spiky"];
const PREDICT = [
  { id: "flash-eu", label: "A smaller managed model on an EU endpoint" },
  { id: "gemma-gke", label: "An open model you self-deploy on GKE" },
  { id: "pro-global", label: "A larger model on the global endpoint" },
];
const ANSWER = "flash-eu";

// Two layouts. Wide (a drawing of 640 px or more): requirements on the left, wired to the rails.
// Narrow (phones): the requirements stacked above the rails at 1:1 scale, so labels stay legible.
const WIDE = { w: 700, h: 320, wires: true, reqX: 6, reqW: 262, reqH: 36, gap: 44, port: 360, l: 388, r: 668, c: 528, railL: 372, railR: 684,
  ay: { size: 58, open: 158, serve: 258 }, rdy: 24, eu: (x, y) => [x, y + 44] };
const NARROW = { w: 320, h: 586, wires: false, reqX: 4, reqW: 312, reqH: 34, gap: 40, port: 0, l: 24, r: 296, c: 160, railL: 12, railR: 308,
  ay: { size: 340, open: 438, serve: 536 }, rdy: 38, eu: (x, y) => [100, y - 34] };
let X = WIDE;
const isNarrow = () => (window.innerWidth || 1100) < 700;
const reqY = (i) => (X === WIDE ? 6 : 4) + i * X.gap;

let ticked = new Set();
let last = null;
let prediction = null;
let reported = false;
let els = {};

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8)); }
const has = (id) => ticked.has(id);

// ---- The decision, straight from the lesson -------------------------------------------------

function decide() {
  const conflicts = [];
  let size;
  if (has("latency") && has("reasoning")) {
    size = { at: "both", text: "Route: a small model for the simple steps, a large one for the hard steps" };
    conflicts.push("Low latency and hard reasoning pull size opposite ways. Route: send the simple steps to a small, fast model and keep the large one for the hard steps.");
  } else if (has("latency")) size = { at: "left", text: "Smaller model (Flash, Flash-Lite)" };
  else if (has("reasoning")) size = { at: "right", text: "Larger model (Pro)" };
  else size = { at: "none", text: "No requirement yet: state one, choose, and confirm with an evaluation" };

  const open = has("weights")
    ? { at: "right", text: "Open weights (Gemma)" }
    : { at: "none", text: "No requirement: proprietary (Gemini) or open (Gemma)" };

  let serve;
  const eu = has("eu");
  if (has("infra")) {
    serve = { at: has("spiky") ? "both" : "right", text: "Self-deployed (endpoint or GKE)" };
    if (has("spiky")) conflicts.push("Spiky traffic pulls serving to MaaS, but the model must run on infrastructure you operate. That stated need wins: self-deploy, and pay for the compute while it is provisioned.");
    if (eu) serve.text += "; it also meets the EU need";
  } else if (has("spiky") && has("steady")) {
    serve = { at: "both", text: "Start managed (MaaS) and measure the traffic" };
    conflicts.push("Spiky traffic and steady, very high volume pull serving opposite ways. Cost at scale is a measurement, not a rule: measure the real traffic before you move off a managed model.");
  } else if (has("steady")) {
    serve = { at: "left", ghost: true, text: "Managed for now; self-deploying may cost less. Measure first" };
  } else if (has("spiky")) {
    serve = { at: "left", text: "Model as a service (MaaS)" };
  } else if (has("weights")) {
    serve = { at: "none", text: "Managed or self-deployed: open weights give you the option to self-deploy, not the obligation" };
  } else {
    serve = { at: "default", text: "Default: start with a managed model (MaaS)" };
  }
  if (eu && !has("infra")) serve.text += ", on an EU endpoint (not the global one), if its documented processing stays in the EU";
  return { size, open, serve, conflicts, eu };
}

// ---- Drawing --------------------------------------------------------------------------------

function wire(r, i) {
  const ym = reqY(i) + X.reqH / 2;
  const ry = X.ay[r.axis];
  const x0 = X.reqX + X.reqW;
  const mid = (x0 + X.port) / 2;
  return `<path id="w-${r.id}" class="wire h-${AXES[r.axis].hue}" d="M${x0},${ym} C${mid},${ym} ${mid},${ry} ${X.port},${ry}"/>`;
}

function reqBox(r, i) {
  const y = reqY(i);
  return `<g class="req" id="r-${r.id}" data-req="${r.id}" role="button" tabindex="0" aria-pressed="false" aria-label="${r.full}">
      <rect class="rb" x="${X.reqX}" y="${y}" width="${X.reqW}" height="${X.reqH}" rx="8"/>
      <rect class="cb" x="${X.reqX + 10}" y="${y + 11}" width="14" height="14" rx="4"/>
      <path class="ck" d="M${X.reqX + 13},${y + 18} l3,3 l6,-7"/>
      <text class="k-label" x="${X.reqX + 32}" y="${y + (X === WIDE ? 16 : 15)}">${r.label}</text>
      <text class="k-small" x="${X.reqX + 32}" y="${y + (X === WIDE ? 29 : 28)}">acts on ${AXES[r.axis].title.toLowerCase()}</text>
    </g>`;
}

function rail(key) {
  const a = AXES[key];
  const y = X.ay[key];
  return `<g class="axis h-${a.hue}" id="a-${key}">
      <text class="k-title" x="${X.railL}" y="${y - 30}">${a.title}</text>
      ${X.wires ? `<circle class="port" cx="${X.port}" cy="${y}" r="4"/>` : ""}
      <line class="rail" x1="${X.railL}" y1="${y}" x2="${X.railR}" y2="${y}"/>
      <line class="clash" id="clash-${key}" x1="${X.l}" y1="${y}" x2="${X.r}" y2="${y}"/>
      <circle class="end" cx="${X.l}" cy="${y}" r="4"/><circle class="end" cx="${X.r}" cy="${y}" r="4"/>
      <text class="endl" id="el-${key}" x="${X.railL}" y="${y + 24}">${a.left}</text>
      <text class="endl" id="er-${key}" x="${X.railR}" y="${y + X.rdy}" text-anchor="end">${a.right}</text>
      <g class="puck" id="p1-${key}"><circle r="11"/></g>
      <g class="puck" id="p2-${key}"><circle r="11"/></g>
      <text class="pl" id="pl-${key}" x="${X.c}" y="${y - 16}" text-anchor="middle"></text>
      ${key === "serve" ? `<g class="eu" id="eu" transform="translate(${X.eu(X.l, y).join(",")})"><rect x="-16" y="-11" width="76" height="20" rx="10"/><text x="22" y="3" text-anchor="middle">EU endpoint</text></g>` : ""}
    </g>`;
}

function build() {
  app.innerHTML = `
    <details class="panel predict" open id="predict">
      <summary class="q">Predict: low latency, data processed in the EU, a small team with spiky traffic. Which option survives?</summary>
      <div class="chips" role="group" aria-label="Your prediction">
        ${PREDICT.map((p) => `<button type="button" class="chip" data-predict="${p.id}" aria-pressed="false">${p.label}</button>`).join("")}
      </div>
      <p class="verdict" id="verdict"></p>
    </details>
    <div class="panel stage">
      <div class="scroll" tabindex="0" role="region" aria-label="Requirements wired to the three axes" id="scroll"></div>
      <p class="caption" id="caption" role="status"></p>
      <dl class="result" id="result" aria-label="Where your requirements lead">
        ${Object.keys(AXES).map((k) => `<div class="row h-${AXES[k].hue}"><dt>${AXES[k].title}</dt><dd id="res-${k}"></dd></div>`).join("")}
      </dl>
      <div class="controls">
        <div class="buttons">
          <button type="button" id="scenario" class="primary">Tick the scenario</button>
          <button type="button" id="clear">Clear</button>
        </div>
      </div>
    </div>
    <p class="legend">Tick a requirement to wire it to the axis it acts on. Orange: size. Violet: openness. Teal: serving. A dashed marker means no requirement moves that axis yet.</p>`;
  els = { scroll: app.querySelector("#scroll"), caption: app.querySelector("#caption"), verdict: app.querySelector("#verdict") };
  drawSvg();
  app.querySelectorAll("[data-predict]").forEach((b) => b.addEventListener("click", () => {
    prediction = b.dataset.predict;
    app.querySelectorAll("[data-predict]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    sim.event("predicted", { prediction });
    check();
    render();
  }));
  app.querySelector("#scenario").addEventListener("click", () => {
    ticked = new Set(SCENARIO);
    last = "scenario";
    sim.event("scenario-ticked", {});
    check();
    render();
  });
  app.querySelector("#clear").addEventListener("click", () => { ticked = new Set(); last = null; render(); });
}

// Writes the drawing for the current layout; called again only when the layout changes.
function drawSvg() {
  X = isNarrow() ? NARROW : WIDE;
  els.scroll.innerHTML = `<svg viewBox="0 0 ${X.w} ${X.h}" role="img" id="drawing" class="${X === WIDE ? "wide" : "narrow"}" aria-label="">
      ${X.wires ? `<g class="wires">${REQS.map(wire).join("")}</g>` : ""}
      ${REQS.map(reqBox).join("")}
      ${Object.keys(AXES).map(rail).join("")}
    </svg>`;
  els.drawing = els.scroll.querySelector("#drawing");
  els.scroll.querySelectorAll(".req").forEach((g) => {
    g.addEventListener("click", () => toggle(g.dataset.req));
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(g.dataset.req); }
    });
  });
}

window.addEventListener("resize", () => {
  if (!els.scroll || (X === NARROW) === isNarrow()) return;
  drawSvg();
  render();
});

function toggle(id) {
  if (ticked.has(id)) ticked.delete(id); else ticked.add(id);
  last = ticked.has(id) ? id : null;
  sim.event("requirement-toggled", { id, on: ticked.has(id) });
  check();
  render();
}

const isScenario = () => ticked.size === SCENARIO.length && SCENARIO.every(has);

function check() {
  if (!reported && prediction && isScenario()) {
    reported = true;
    sim.checkpoint("observe-requirement-choice");
  }
}

function place(key, st) {
  const a = AXES[key];
  const p1 = app.querySelector(`#p1-${key}`);
  const p2 = app.querySelector(`#p2-${key}`);
  const pl = app.querySelector(`#pl-${key}`);
  const at = st.at;
  const pos = (x) => `translate(${x}px, ${X.ay[key]}px)`;
  let x1 = X.c, x2 = X.c, label = "", show2 = false, idle = false;
  if (at === "left") { x1 = X.l; }
  else if (at === "right") { x1 = X.r; }
  else if (at === "both") { x1 = X.l; x2 = X.r; show2 = true; label = "pulled both ways"; }
  else if (at === "default") { x1 = X.l; idle = true; label = "default"; }
  else { idle = true; label = "no requirement"; }
  if (st.ghost) { x2 = X.r; show2 = true; label = "measure first"; }
  p1.style.transform = pos(x1);
  p2.style.transform = pos(x2);
  p1.setAttribute("class", `puck${idle ? " idle" : ""}`);
  p2.setAttribute("class", `puck${st.ghost ? " idle" : ""}${show2 ? "" : " gone"}`);
  pl.textContent = label;
  pl.setAttribute("x", String(at === "default" ? X.l + 34 : st.ghost ? X.r : X.c));
  pl.setAttribute("text-anchor", at === "default" ? "start" : st.ghost ? "end" : "middle");
  pl.setAttribute("class", `pl${at === "both" ? " bad" : ""}`);
  app.querySelector(`#clash-${key}`).setAttribute("class", `clash${at === "both" ? " on" : ""}`);
  app.querySelector(`#el-${key}`).setAttribute("class", `endl${at === "left" || at === "both" || at === "default" ? " lean" : ""}`);
  app.querySelector(`#er-${key}`).setAttribute("class", `endl${at === "right" || at === "both" ? " lean" : ""}`);
}

function captionText(d) {
  if (prediction && isScenario()) {
    return "Low latency moves size to a smaller model. Spiky traffic with nothing to operate moves serving to MaaS. The EU need is met by an EU endpoint, once you confirm the model's documented processing stays in the EU.";
  }
  if (isScenario() && !prediction) return "This is the scenario. Make your prediction above, then compare.";
  if (d.conflicts.length) return d.conflicts.join(" ");
  if (last && BY_ID[last]) return BY_ID[last].why;
  if (!ticked.size) return "Tick the requirements a scenario has. Each acts on one axis and pulls it toward a lean. With none ticked, the default holds: start with a managed model.";
  return "Each ticked requirement pulls one axis. A real scenario usually combines several rows.";
}

function render() {
  const d = decide();
  for (const r of REQS) {
    const on = has(r.id);
    const g = app.querySelector(`#r-${r.id}`);
    g.setAttribute("aria-pressed", String(on));
    g.setAttribute("class", `req${on ? " on" : ""}`);
    if (X.wires) app.querySelector(`#w-${r.id}`).setAttribute("class", `wire h-${AXES[r.axis].hue}${on ? " on" : ""}`);
  }
  place("size", d.size);
  place("open", d.open);
  place("serve", d.serve);
  const eu = app.querySelector("#eu");
  eu.setAttribute("class", `eu${d.eu ? "" : " gone"}`);
  eu.setAttribute("transform", `translate(${(X === WIDE ? [d.serve.at === "right" ? X.r - 60 : X.l, X.ay.serve + 44] : X.eu(0, X.ay.serve)).join(",")})`);
  for (const k of Object.keys(AXES)) app.querySelector(`#res-${k}`).textContent = d[k].text;
  els.caption.textContent = captionText(d);
  const picked = REQS.filter((r) => has(r.id)).map((r) => r.full.toLowerCase());
  els.drawing.setAttribute("aria-label", `Seven requirements wired to three axes: size, openness and serving. ${picked.length ? `Ticked: ${picked.join("; ")}.` : "None ticked."} Size: ${d.size.text}. Openness: ${d.open.text}. Serving: ${d.serve.text}.${d.conflicts.length ? " Conflict called out." : ""}`);
  let verdict = "";
  if (prediction && isScenario()) {
    verdict = prediction === ANSWER
      ? "You predicted a smaller managed model on an EU endpoint: right. It meets all three requirements with nothing to operate."
      : prediction === "gemma-gke"
        ? "You predicted self-deploying on GKE. It meets residency, but a small team with spiky traffic wants nothing to operate. A smaller managed model on an EU endpoint survives."
        : "You predicted a larger model on the global endpoint. The global endpoint gives no residency guarantee, and low latency asks for a smaller model. A smaller managed model on an EU endpoint survives.";
  }
  els.verdict.textContent = verdict;
  reportSize();
}

const sim = createSim({
  onInit({ theme, reducedMotion }) {
    applyTheme(theme);
    if (reducedMotion) document.documentElement.classList.add("reduced");
    build();
    render();
  },
});

// Fallback for opening the bundle directly (no host init).
setTimeout(() => {
  if (!sim.isInitialized() && app.childElementCount === 0) { build(); render(); }
}, 300);
