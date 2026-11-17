// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// The same order-support request run two ways, with the agent-loop-stepper's transcript.
// In the fixed workflow the designer wired every step and branch in advance; a model only
// drafts the reply. In the agent the model picks each next tool call after reading the
// last result. With the expected tool result both reach the same outcome, and the
// workflow is cheaper. With an unexpected result (a partly shipped order) the workflow
// falls through to the branch the designer left for "anything else"; the agent chooses a
// step nobody wired. The agent's choices are a scripted teaching fixture: a real model
// could choose differently, which is the predictability that autonomy costs.

const app = document.getElementById("app");

const REQUEST = "Please send order A1234 to my new address: 12 Rue Victor Hugo, Lyon.";
const ADDR = 'address="12 Rue Victor Hugo, Lyon"';
const RESULTS = {
  expected: '{"status": "processing"}',
  unexpected: '{"status": "partially_shipped", "parts": [{"id": "A1234-1", "status": "shipped"}, {"id": "A1234-2", "status": "processing"}]}',
};

const PLAN = {
  workflow: {
    title: "The path the designer wired",
    items: [
      'Run <span class="mono">get_order_status(order_id)</span>.',
      'If status is <span class="mono">"processing"</span>: run <span class="mono">update_address</span>. If <span class="mono">"shipped"</span>: say it is too late. Anything else: <span class="mono">handoff_to_human</span>.',
      "A model drafts the reply from the outcome.",
    ],
  },
  agent: {
    title: "Tools the model may call, in any order",
    items: [
      '<span class="mono name">get_order_status(order_id)</span>: status of an order and of each of its parts.',
      '<span class="mono name">update_address(order_id, address)</span>: changes the address of an order or part not yet shipped.',
      '<span class="mono name">handoff_to_human(reason)</span>: passes the conversation to a person.',
    ],
  },
};

// Each step: { kind, who, by, html }. `by` is who chose this step: "designer", "model" or null.
function script(mode, result) {
  const user = { kind: "user", who: "User", by: null, html: esc(REQUEST) };
  const status = { kind: "tool", who: "Runtime", by: mode === "workflow" ? "designer" : null, html: `Runs <span class="mono">get_order_status(order_id="A1234")</span>: <span class="mono">${esc(RESULTS[result])}</span>` };
  if (mode === "workflow") {
    if (result === "expected") {
      return {
        outcome: "Address changed",
        steps: [
          user,
          status,
          { kind: "wired", who: "Workflow branch", by: "designer", html: `Status is <span class="mono">"processing"</span>, so the wired branch runs <span class="mono">update_address(order_id="A1234", ${esc(ADDR)})</span>: <span class="mono">{"status": "updated"}</span>` },
          { kind: "answer", who: "Model call 1", by: null, html: "Drafts the reply the workflow asked for: “Done: order A1234 will go to 12 Rue Victor Hugo, Lyon.”" },
        ],
      };
    }
    return {
      outcome: "Handed to a person; nothing changed",
      steps: [
        user,
        status,
        { kind: "wired", who: "Workflow branch", by: "designer", html: `<span class="mono">"partially_shipped"</span> matches no branch the designer wrote, so the “anything else” branch runs <span class="mono">handoff_to_human(reason="unhandled status")</span>.` },
        { kind: "answer", who: "Model call 1", by: null, html: "Drafts the reply the workflow asked for: “I've passed your request to a colleague, who will get back to you.”" },
      ],
    };
  }
  const first = { kind: "model", who: "Model call 1", by: "model", html: 'Chooses <span class="mono">get_order_status(order_id="A1234")</span> as the first step.' };
  if (result === "expected") {
    return {
      outcome: "Address changed",
      steps: [
        user,
        first,
        status,
        { kind: "model", who: "Model call 2", by: "model", html: `Reads the result and chooses <span class="mono">update_address(order_id="A1234", ${esc(ADDR)})</span>.` },
        { kind: "tool", who: "Runtime", by: null, html: 'Runs <span class="mono">update_address</span>: <span class="mono">{"status": "updated"}</span>' },
        { kind: "answer", who: "Model call 3", by: "model", html: "Decides it is done and answers: “Done: order A1234 will go to 12 Rue Victor Hugo, Lyon.”" },
      ],
    };
  }
  return {
    outcome: "Unshipped part redirected; user asked about the rest",
    steps: [
      user,
      first,
      status,
      { kind: "model", who: "Model call 2", by: "model", html: `Reads that one part has shipped and one has not, and chooses <span class="mono">update_address(order_id="A1234-2", ${esc(ADDR)})</span>, a step nobody wired.` },
      { kind: "tool", who: "Runtime", by: null, html: 'Runs <span class="mono">update_address</span>: <span class="mono">{"status": "updated"}</span>' },
      { kind: "answer", who: "Model call 3", by: "model", html: "Answers: “Part A1234-2 has not shipped, so it will go to your new address. Part A1234-1 already left for the old one. Shall I pass that part to a colleague to redirect?”" },
    ],
  };
}

let mode = "workflow";
let result = "unexpected";
let run = null;
let shown = 1;
let timer = null;
let finished = { workflow: false, agent: false }; // runs completed with the unexpected result
let reported = false;
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

function done() {
  return shown >= run.steps.length;
}

function resetRun() {
  stopAuto();
  run = script(mode, result);
  shown = 1;
}

function step() {
  if (done()) return;
  shown += 1;
  if (done()) {
    sim.event("run-finished", { mode, result });
    if (result === "unexpected") finished[mode] = true;
    if (!reported && finished.workflow && finished.agent) {
      reported = true;
      sim.checkpoint("observe-who-decides");
    }
  }
}

function stopAuto() {
  if (timer) clearInterval(timer);
  timer = null;
  if (els.auto) els.auto.textContent = "Auto";
}

function startAuto() {
  if (done()) return;
  els.auto.textContent = "Pause";
  timer = setInterval(() => {
    step();
    renderRun();
    if (done()) stopAuto();
  }, 900);
}

function build() {
  app.innerHTML = `
    <div class="controls">
      <label class="field">Who controls the path
        <select id="mode">
          <option value="workflow">Fixed workflow (designer)</option>
          <option value="agent">Agent (model)</option>
        </select>
      </label>
      <label class="field">What get_order_status returns
        <select id="result">
          <option value="expected">Expected: still processing</option>
          <option value="unexpected">Unexpected: partly shipped</option>
        </select>
      </label>
      <div class="buttons">
        <button id="step">Step</button>
        <button id="auto" class="secondary">Auto</button>
        <button id="reset" class="secondary">Reset</button>
      </div>
    </div>
    <p class="readout" id="readout" role="status"></p>
    <section class="decls" aria-labelledby="plan-h">
      <h2 id="plan-h"></h2>
      <ul id="plan"></ul>
    </section>
    <section class="transcript" aria-labelledby="tr-h">
      <h2 id="tr-h">The run, step by step</h2>
      <ol id="rows"></ol>
    </section>
    <p class="legend">Tags show who chose each step. The agent's choices are a scripted teaching fixture; a real model may choose differently on another run.</p>`;
  els = {};
  for (const id of ["mode", "result", "step", "auto", "reset", "readout", "plan", "rows"]) els[id] = app.querySelector(`#${id}`);
  els.planH = app.querySelector("#plan-h");
  els.mode.value = mode;
  els.result.value = result;
  els.mode.addEventListener("change", () => { mode = els.mode.value; resetRun(); renderAll(); });
  els.result.addEventListener("change", () => { result = els.result.value; resetRun(); renderAll(); });
  els.step.addEventListener("click", () => { stopAuto(); step(); renderRun(); });
  els.auto.addEventListener("click", () => { if (timer) stopAuto(); else startAuto(); });
  els.reset.addEventListener("click", () => { resetRun(); renderAll(); });
}

function renderPlan() {
  els.planH.textContent = PLAN[mode].title;
  els.plan.innerHTML = PLAN[mode].items.map((i) => `<li>${i}</li>`).join("");
}

function renderRun() {
  const visible = run.steps.slice(0, shown);
  const tag = (by) => (by === "designer" ? '<span class="tag designer">Designer chose</span>' : by === "model" ? '<span class="tag model">Model chose</span>' : "");
  const rows = visible.map((e) => `<li class="row ${e.kind}"><span class="who">${esc(e.who)}${tag(e.by)}</span><span>${e.html}</span></li>`);
  if (!done()) rows.push(`<li class="pending">Next: step ${shown + 1} of ${run.steps.length}. Press Step or Auto.</li>`);
  els.rows.innerHTML = rows.join("");
  const byDesigner = visible.filter((e) => e.by === "designer").length;
  const byModel = visible.filter((e) => e.by === "model").length;
  const modelCalls = visible.filter((e) => /^Model call/.test(e.who)).length;
  const counts = `Steps chosen by the designer: ${byDesigner} · by the model: ${byModel} · model calls: ${modelCalls}`;
  els.readout.className = `readout${done() ? " done" : ""}`;
  els.readout.textContent = done() ? `${run.outcome}. ${counts}.` : `${counts}.`;
  reportSize();
}

function renderAll() {
  renderPlan();
  renderRun();
}

function readProps(props) {
  if (!props) return;
  if (props.mode === "workflow" || props.mode === "agent") mode = props.mode;
  if (RESULTS[props.result]) result = props.result;
}

document.addEventListener("visibilitychange", () => { if (document.hidden) stopAuto(); });

const sim = createSim({
  onInit({ props, theme }) {
    applyTheme(theme);
    readProps(props);
    build();
    resetRun();
    renderAll();
  },
});

// Fallback for opening the bundle directly (no host init).
setTimeout(() => {
  if (!sim.isInitialized() && app.childElementCount === 0) {
    build();
    resetRun();
    renderAll();
  }
}, 300);
