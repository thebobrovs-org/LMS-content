// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// Where a human approval sits decides whether it can stop a side effect. Before the tool:
// ADK tool confirmation (FunctionTool(..., require_confirmation=True or a function of the
// arguments)) pauses the call; a rejection means the tool never runs and the model gets
// {"error": "This tool call is rejected."} (adk-python function_tool.py). After the tool:
// a review triggered from an after_tool_callback sees a call that has already run, so a
// denial cannot unmove the money. Fictional store, amounts and threshold; deterministic.

const app = document.getElementById("app");

const START_BALANCE = 5000;
const THRESHOLD = 100;
const REQUESTS = {
  large: { order: "L-31", amount: 400, item: "chair", text: "Please refund €400 for order L-31. The chair arrived broken." },
  small: { order: "M-12", amount: 40, item: "mug", text: "Please refund €40 for order M-12. The mug arrived chipped." },
};
const PLACEMENTS = {
  before: "Before the tool: tool confirmation",
  after: "After the tool: review in after_tool_callback",
  none: "No approval",
};
const POLICIES = {
  always: "Every refund",
  threshold: `Refunds over €${THRESHOLD}`,
};
const DECISIONS = { deny: "Deny", approve: "Approve" };

let request = "large";
let placement = "before";
let policy = "always";
let decision = "deny";
let steps = [];
let shown = 0;
let timer = null;
let seenBefore = false; // denied before the tool: no money moved
let seenAfter = false; // denied after the tool: money already moved
let reported = false;
let els = {};

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const eur = (n) => `€${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

// The whole run for the current settings, as a list of steps. Each step names the stage it
// belongs to, and whether money moves in it.
function plan() {
  const r = REQUESTS[request];
  const needs = policy === "always" || r.amount > THRESHOLD;
  const call = `issue_refund(order_id="${r.order}", amount=${r.amount})`;
  const denied = decision === "deny";
  const out = [{ stage: "request", kind: "user", who: "Customer", html: esc(r.text) }];
  out.push({ stage: "model", kind: "model", who: "Model call 1", html: `Proposes <span class="mono">${esc(call)}</span>. It runs nothing itself.` });
  const run = () => out.push({ stage: "tool", kind: "tool", who: "Runtime", money: r.amount, html: `Runs <span class="mono">issue_refund</span>. ${eur(r.amount)} leaves the store's account. Result: <span class="mono">{"status": "refunded", "refund_id": "R-5001"}</span>` });
  const reply = (text) => out.push({ stage: "reply", kind: "answer", who: "Model call 2", html: esc(text) });

  if (placement === "before") {
    const how = policy === "always" ? "require_confirmation=True" : `require_confirmation(amount=${r.amount}) returns ${needs ? "True" : "False"}`;
    if (!needs) {
      out.push({ stage: "gate", kind: "gate", who: "Runtime", html: `<span class="mono">${esc(how)}</span>, so the call does not pause.` });
      run();
      reply(`Done: ${eur(r.amount)} is on its way back to you.`);
    } else {
      out.push({ stage: "gate", kind: "gate", who: "Runtime", html: `<span class="mono">${esc(how)}</span>. The tool pauses <strong>before it runs</strong>; the client receives an <span class="mono">adk_request_confirmation</span> event.` });
      out.push({ stage: "gate", kind: denied ? "stop" : "ok", who: "Approver", html: denied ? "Denies the refund." : "Approves the refund." });
      if (denied) {
        out.push({ stage: "tool", kind: "tool", who: "Runtime", html: `<span class="mono">issue_refund</span> never runs. The model receives <span class="mono">{"error": "This tool call is rejected."}</span>` });
        reply(`I couldn't issue that refund: it was declined in review. A colleague will contact you about the ${r.item}.`);
      } else {
        run();
        reply(`Approved and done: ${eur(r.amount)} is on its way back to you.`);
      }
    }
  } else if (placement === "after") {
    run();
    if (!needs) {
      out.push({ stage: "review", kind: "gate", who: "Runtime", html: `The after_tool_callback sees ${eur(r.amount)}, under the €${THRESHOLD} threshold, and asks for no review.` });
      reply(`Done: ${eur(r.amount)} is on its way back to you.`);
    } else {
      out.push({ stage: "review", kind: "gate", who: "Runtime", html: "The after_tool_callback sends the finished call to a reviewer. The refund has already gone out." });
      out.push({ stage: "review", kind: denied ? "stop" : "ok", who: "Reviewer", html: denied ? `Denies it. The denial is recorded, but the ${eur(r.amount)} has already left; getting it back needs a separate reversal, which may not be possible.` : "Approves it after the fact." });
      reply(`Done: ${eur(r.amount)} is on its way back to you.`);
    }
  } else {
    run();
    reply(`Done: ${eur(r.amount)} is on its way back to you.`);
  }
  return out;
}

function resetRun() {
  stopAuto();
  steps = plan();
  shown = 1;
}

function done() {
  return shown >= steps.length;
}

function step() {
  if (done()) return;
  shown += 1;
  if (done()) finish();
}

function finish() {
  const r = REQUESTS[request];
  const moved = steps.some((s) => s.money);
  const reviewed = steps.some((s) => s.who === "Approver" || s.who === "Reviewer");
  sim.event("run-finished", { request, placement, policy, decision, moved });
  if (reviewed && decision === "deny") {
    if (placement === "before" && !moved) seenBefore = true;
    if (placement === "after" && moved) seenAfter = true;
  }
  if (!reported && seenBefore && seenAfter) {
    reported = true;
    sim.checkpoint("observe-approval-before-side-effect");
    sim.event("gate-placement-compared", { amount: r.amount });
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
  const sel = (id, label, opts) => `
      <label class="field">${label}
        <select id="${id}">${Object.entries(opts).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
      </label>`;
  app.innerHTML = `
    <div class="controls">
      ${sel("request", "Refund request", { large: "€400, order L-31", small: "€40, order M-12" })}
      ${sel("placement", "Approval placement", PLACEMENTS)}
      ${sel("policy", "Ask for approval on", POLICIES)}
      ${sel("decision", "Approver's answer", DECISIONS)}
      <div class="buttons">
        <button id="step">Step</button>
        <button id="auto" class="secondary">Auto</button>
        <button id="reset" class="secondary">Reset</button>
      </div>
    </div>
    <ol class="stages" id="stages" aria-label="Where the run is"></ol>
    <section class="ledger" aria-labelledby="ledger-h">
      <h2 id="ledger-h">Store refunds account</h2>
      <p id="ledger"></p>
    </section>
    <p class="readout" id="readout" role="status"></p>
    <section class="transcript" aria-labelledby="tr-h">
      <h2 id="tr-h">The run, step by step</h2>
      <ol id="rows"></ol>
    </section>
    <p class="legend">A fictional store, threshold and refund. Each run starts from the same balance, so the two placements compare like for like.</p>`;
  els = {};
  for (const id of ["request", "placement", "policy", "decision", "step", "auto", "reset", "stages", "ledger", "readout", "rows"]) {
    els[id] = app.querySelector(`#${id}`);
  }
  els.request.value = request;
  els.placement.value = placement;
  els.policy.value = policy;
  els.decision.value = decision;
  const onChange = () => {
    request = els.request.value;
    placement = els.placement.value;
    policy = els.policy.value;
    decision = els.decision.value;
    resetRun();
    renderRun();
  };
  for (const id of ["request", "placement", "policy", "decision"]) els[id].addEventListener("change", onChange);
  els.step.addEventListener("click", () => { stopAuto(); step(); renderRun(); });
  els.auto.addEventListener("click", () => { if (timer) stopAuto(); else startAuto(); });
  els.reset.addEventListener("click", () => { resetRun(); renderRun(); });
}

function renderRun() {
  const visible = steps.slice(0, shown);
  const at = visible[visible.length - 1].stage;
  const stages = [
    { id: "request", label: "Request" },
    { id: "model", label: "Model proposes" },
    { id: "gate", label: "Approval before", off: placement !== "before" },
    { id: "tool", label: "Tool runs: money moves" },
    { id: "review", label: "Review after", off: placement !== "after" },
    { id: "reply", label: "Reply" },
  ];
  els.stages.innerHTML = stages.map((s) => `<li class="stage${s.off ? " off" : ""}${s.id === at ? " now" : ""}">${esc(s.label)}${s.off ? " (none)" : ""}${s.id === at ? '<span class="sr"> (current step)</span>' : ""}</li>`).join("");

  const movedStep = visible.find((s) => s.money);
  const moved = movedStep ? movedStep.money : 0;
  els.ledger.innerHTML = movedStep
    ? `Balance <span class="mono">${eur(START_BALANCE - moved)}</span> · <span class="moved">−${eur(moved)} refund R-5001 paid out</span>`
    : `Balance <span class="mono">${eur(START_BALANCE)}</span> · <span class="still">no money has moved</span>`;

  const rows = visible.map((e) => `<li class="row ${e.kind}"><span class="who">${esc(e.who)}</span><span>${e.html}</span></li>`);
  if (!done()) rows.push(`<li class="pending">Next: step ${shown + 1} of ${steps.length}. Press Step or Auto.</li>`);
  els.rows.innerHTML = rows.join("");

  const reviewed = steps.some((s) => s.who === "Approver" || s.who === "Reviewer");
  let text;
  if (!done()) text = `Step ${shown} of ${steps.length} · ${moved ? `${eur(moved)} has left the account` : "no money has moved yet"}.`;
  else if (!reviewed) text = `Finished without a human decision · ${moved ? `${eur(moved)} paid out` : "no money moved"}.`;
  else if (decision === "deny" && !moved) text = "Denied before issue_refund ran · no money moved.";
  else if (decision === "deny") text = `Denied after issue_refund ran · ${eur(moved)} had already left. The denial changed nothing.`;
  else text = `Approved · ${eur(moved)} paid out.`;
  els.readout.className = `readout${done() && reviewed && decision === "deny" ? (moved ? " stopped" : " done") : ""}`;
  els.readout.textContent = text;
  reportSize();
}

function readProps(props) {
  if (!props) return;
  if (PLACEMENTS[props.placement]) placement = props.placement;
  if (REQUESTS[props.request]) request = props.request;
}

document.addEventListener("visibilitychange", () => { if (document.hidden) stopAuto(); });

const sim = createSim({
  onInit({ props, theme }) {
    applyTheme(theme);
    readProps(props);
    build();
    resetRun();
    renderRun();
  },
});

// Fallback for opening the bundle directly (no host init).
setTimeout(() => {
  if (!sim.isInitialized() && app.childElementCount === 0) {
    build();
    resetRun();
    renderRun();
  }
}, 300);
