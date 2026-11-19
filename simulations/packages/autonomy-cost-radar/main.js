// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// What autonomy costs (topics/agentic-ai/what-is-an-agent.mdx, "What autonomy costs"). A radar
// with one axis for what autonomy gives (flexibility) and four for what it costs, the lesson's
// own four: predictability (drawn as unpredictability, so every axis grows outward), testing
// effort, latency and cost, and risk. Three shapes: a chat or single model call, a workflow and
// an agent. The learner picks a task from the lesson (its summariser, invoice pipeline and IT
// troubleshooter); an amber mark shows the flexibility it needs, and the caption names the least
// autonomy that clears it and what anything more costs. Levels are illustrative and ordinal,
// read from the lesson's own descriptions. Deterministic; the only motion is a short transition
// a choice starts.

const app = document.getElementById("app");

const AXES = [
  { id: "flex", label: "Flexibility", sub: "what it gives", anchor: "middle" },
  { id: "unpred", label: "Unpredictability", sub: "cost", anchor: "start" },
  { id: "test", label: "Testing effort", sub: "cost", anchor: "start" },
  { id: "lat", label: "Latency & cost", sub: "cost", anchor: "end" },
  { id: "risk", label: "Risk", sub: "cost", anchor: "end" },
];
const COSTS = AXES.slice(1);
const LEVEL = ["", "low", "medium", "high", "very high"];

const SYSTEMS = [
  { id: "chat", name: "Chat or single call", short: "Chat", hue: "orange",
    v: { flex: 1, unpred: 1, test: 1, lat: 1, risk: 1 } },
  { id: "workflow", name: "Workflow", short: "Workflow", hue: "teal",
    v: { flex: 2, unpred: 1, test: 2, lat: 2, risk: 2 } },
  { id: "agent", name: "Agent", short: "Agent", hue: "violet",
    v: { flex: 4, unpred: 4, test: 4, lat: 3, risk: 4 } },
];
const SYS = Object.fromEntries(SYSTEMS.map((s) => [s.id, s]));

// The lesson's own examples, each with the flexibility its path needs.
const TASKS = [
  { id: "ticket", name: "Ticket summary", the: "the ticket summariser", need: 1,
    fit: "One fixed call, one output: nothing chooses a next step, so it needs good prompting, not agent machinery.",
    short: {} },
  { id: "invoice", name: "Invoice pipeline", the: "the invoice pipeline", need: 2,
    fit: "Every invoice takes the same steps: extract with a model, check in code, route for approval. The designer can lay out the path.",
    short: { chat: "a chat waits for the user to direct each step, and nothing runs the check and the routing on its own" } },
  { id: "it", name: "IT troubleshooter", the: "the IT troubleshooter", need: 4,
    fit: "Each finding decides the next check, so no one can lay out the path in advance. Here the costs buy something: pay for them with path-level evals and guardrails.",
    short: {
      chat: "it must read logs, look up devices and open tickets on its own, not wait for the user at every step",
      workflow: "no one can write its decision tree in advance, so a workflow handles only the cases someone foresaw",
    } },
];
const TASK = Object.fromEntries(TASKS.map((t) => [t.id, t]));

const PREDICT = [
  { id: "none", label: "None: it is just smarter" },
  { id: "some", label: "One or two" },
  { id: "four", label: "All four" },
];
const ANSWER = "four";

// Geometry: a pentagon of radius R, flexibility at the top, the costs clockwise.
const W = 412, H = 296, CX = 198, CY = 166, R = 100, STEP = R / 4;
const angle = (i) => ((-90 + 72 * i) * Math.PI) / 180;
const pt = (i, r) => [CX + r * Math.cos(angle(i)), CY + r * Math.sin(angle(i))];
const fmt = (p) => p.map((n) => n.toFixed(1)).join(",");

let task = "invoice";
let system = "workflow";
let prediction = null;
let sawAgentOverbuilt = false;
let reported = false;
let els = {};

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8)); }

const least = (t) => SYSTEMS.find((s) => s.v.flex >= TASK[t].need);
const poly = (s) => AXES.map((a, i) => fmt(pt(i, s.v[a.id] * STEP))).join(" ");

// ---- Drawing --------------------------------------------------------------------------------

function grid() {
  let out = "";
  for (let l = 1; l <= 4; l++) {
    out += `<polygon class="ring" points="${AXES.map((_, i) => fmt(pt(i, l * STEP))).join(" ")}"/>`;
  }
  AXES.forEach((a, i) => {
    const [x, y] = pt(i, R);
    out += `<line class="spoke${i === 0 ? " gives" : ""}" x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    let [lx, ly] = pt(i, R + 14);
    if (i === 0) ly = CY - R - 26;
    else if (i === 2 || i === 3) { ly += 12; lx += i === 2 ? -10 : 10; }
    else ly += 4;
    out += `<text class="k-label ax${i === 0 ? " gives" : ""}" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${a.anchor}">${a.label}</text>`;
    out += `<text class="k-small" x="${lx.toFixed(1)}" y="${(ly + 13).toFixed(1)}" text-anchor="${a.anchor}">${a.sub}</text>`;
  });
  return out;
}

function shapes() {
  return SYSTEMS.map((s) => `<g class="sys h-${s.hue}" id="s-${s.id}">
      <polygon class="shape" points="${poly(s)}"/>
      ${AXES.map((a, i) => { const [x, y] = pt(i, s.v[a.id] * STEP); return `<circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"/>`; }).join("")}
      <text class="name" x="${CX + 9}" y="${(CY - s.v.flex * STEP + 4).toFixed(1)}">${s.short}</text>
    </g>`).join("");
}

function build() {
  app.innerHTML = `
    <details class="panel predict" open id="predict">
      <summary class="q">Predict: you turn the invoice workflow into an agent. How many of the four costs grow?</summary>
      <div class="chips" role="group" aria-label="Your prediction">
        ${PREDICT.map((p) => `<button type="button" class="chip" data-predict="${p.id}" aria-pressed="false">${p.label}</button>`).join("")}
      </div>
      <p class="verdict" id="verdict" role="status"></p>
    </details>
    <div class="panel stage">
      <div class="scroll" tabindex="0" role="region" aria-label="Radar of what autonomy gives and costs">
        <svg viewBox="0 0 ${W} ${H}" role="img" id="drawing" aria-label="">
          <g class="grid">${grid()}</g>
          <g id="shapes">${shapes()}</g>
          <g class="need" id="need">
            <line id="need-line" x1="${CX - 16}" x2="${CX + 4}" y1="0" y2="0"/>
            <text id="need-text" class="needl" x="${CX - 22}" y="0" text-anchor="end">task needs</text>
          </g>
        </svg>
      </div>
      <p class="caption" id="caption" role="status"></p>
      <div class="controls">
        <div class="chips" role="group" aria-label="Task">
          <span class="seglabel">Task</span>
          ${TASKS.map((t) => `<button type="button" class="chip" data-task="${t.id}" aria-pressed="false">${t.name}</button>`).join("")}
        </div>
        <div class="chips" role="group" aria-label="System">
          <span class="seglabel">System</span>
          ${SYSTEMS.map((s) => `<button type="button" class="chip" data-system="${s.id}" aria-pressed="false" aria-label="${s.name}">${s.short}</button>`).join("")}
        </div>
        <div class="buttons">
          <button type="button" id="agent" class="primary">Swap in an agent</button>
          <button type="button" id="reset">Reset</button>
        </div>
      </div>
      <p class="readout" id="readout"></p>
    </div>
    <p class="legend">Orange: chat or single call. Teal: workflow. Violet: agent (bold: the one you picked). Amber mark: the flexibility the task needs. Every axis grows outward from low to very high; levels are illustrative.</p>`;
  els = {
    drawing: app.querySelector("#drawing"), caption: app.querySelector("#caption"),
    verdict: app.querySelector("#verdict"), readout: app.querySelector("#readout"),
    shapes: app.querySelector("#shapes"),
  };
  app.querySelectorAll("[data-predict]").forEach((b) => b.addEventListener("click", () => {
    prediction = b.dataset.predict;
    sim.event("predicted", { prediction });
    render();
  }));
  app.querySelectorAll("[data-task]").forEach((b) => b.addEventListener("click", () => {
    task = b.dataset.task;
    sim.event("task-picked", { task });
    render();
  }));
  app.querySelectorAll("[data-system]").forEach((b) => b.addEventListener("click", () => pickSystem(b.dataset.system)));
  app.querySelector("#agent").addEventListener("click", () => pickSystem("agent"));
  app.querySelector("#reset").addEventListener("click", () => { task = "invoice"; system = "workflow"; render(); });
}

function pickSystem(id) {
  system = id;
  sim.event("system-picked", { system, task });
  render();
}

// ---- State to words -------------------------------------------------------------------------

function costsUp(a, b) { return COSTS.filter((c) => a.v[c.id] > b.v[c.id]); }

function describe() {
  const t = TASK[task], s = SYS[system], l = least(task);
  if (s.v.flex < t.need) {
    return {
      kind: "short",
      caption: `${s.name} can't solve ${t.the}: ${t.short[s.id]}. Move right only as far as it takes: ${l.name.toLowerCase()}.`,
      readout: `Short of what the task needs by ${t.need - s.v.flex} level${t.need - s.v.flex > 1 ? "s" : ""} of flexibility.`,
    };
  }
  if (s === l) {
    return {
      kind: "fit",
      caption: `${s.name} is the least autonomy that solves it. ${t.fit}`,
      readout: `${s.name}: enough for this task. Costs: ${COSTS.map((c) => `${c.label.toLowerCase()} ${LEVEL[s.v[c.id]]}`).join(", ")}.`,
    };
  }
  const up = costsUp(s, l);
  return {
    kind: "over",
    caption: `${s.name} solves it, but ${l.name.toLowerCase()} already does. The extra flexibility buys nothing here, and ${up.length === 4 ? "all four" : `${up.length} of the four`} costs grow: ${up.map((c) => c.label.toLowerCase()).join(", ")}.`,
    readout: `${s.name} vs ${l.name.toLowerCase()}: flexibility +${s.v.flex - l.v.flex} (not needed), costs up on ${up.length} of 4 axes.`,
  };
}

function verdictText() {
  if (!prediction || !sawAgentOverbuilt) return "";
  const up = costsUp(SYS.agent, SYS.workflow).length;
  if (prediction === ANSWER) return `You predicted all four: right. All ${up} grow, and the invoice path needed none of the extra flexibility.`;
  if (prediction === "none") return `You predicted none. An agent is not a free upgrade: all ${up} costs grow, because the model now picks the path and every pick can differ, take turns and go wrong.`;
  return `You predicted one or two. All ${up} grow together: once the model picks the path, the path varies, needs checking, takes more turns and can go wrong.`;
}

function render() {
  const t = TASK[task], s = SYS[system], d = describe();
  for (const x of SYSTEMS) {
    const g = app.querySelector(`#s-${x.id}`);
    const short = x.v.flex < t.need;
    g.setAttribute("class", `sys h-${x.hue}${x.id === system ? " on" : ""}${short ? " short" : ""}`);
  }
  // Draw the picked shape last, on top.
  els.shapes.appendChild(app.querySelector(`#s-${system}`));
  const ny = CY - t.need * STEP;
  app.querySelector("#need-line").setAttribute("y1", ny.toFixed(1));
  app.querySelector("#need-line").setAttribute("y2", ny.toFixed(1));
  app.querySelector("#need-text").setAttribute("y", (ny + 4).toFixed(1));

  app.querySelectorAll("[data-task]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.task === task)));
  app.querySelectorAll("[data-system]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.system === system)));
  app.querySelectorAll("[data-predict]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.predict === prediction)));

  if (system === "agent" && task === "invoice") sawAgentOverbuilt = true;
  if (!reported && system === "agent" && d.kind === "over") {
    reported = true;
    sim.checkpoint("observe-autonomy-cost");
  }

  els.caption.textContent = d.caption;
  els.readout.textContent = d.readout;
  els.readout.className = `readout ${d.kind}`;
  els.verdict.textContent = verdictText();
  els.drawing.setAttribute("aria-label",
    `Radar of five axes: flexibility, what autonomy gives, and four costs. Task: ${t.name}, which needs ${LEVEL[t.need]} flexibility. ` +
    SYSTEMS.map((x) => `${x.name}: ${AXES.map((a) => `${a.label.toLowerCase()} ${LEVEL[x.v[a.id]]}`).join(", ")}`).join(". ") +
    `. Picked: ${s.name}.`);
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
