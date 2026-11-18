// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// The agent loop, one event at a time. The model reads the instruction, the tool
// declarations and the history, and proposes either a tool call or a final answer.
// The runtime (not the model) executes each proposed call and appends the result.
// The loop ends on a final answer or when the next model call would pass the cap.
// Everything is scripted and deterministic; token counts are illustrative.

const app = document.getElementById("app");

const REQUESTS = {
  order: "Where is order A1234, and can I still change the delivery address?",
  returns: "What is your return policy?",
};

// Tool declarations the model sees. The functions behind them are the same in both
// modes; only the names and descriptions change.
const DECLS = {
  clear: [
    { name: "get_order_status(order_id)", desc: "Returns the status and tracking id of one order. Use when the user gives an order id." },
    { name: "get_shipment(tracking_id)", desc: "Returns the carrier's latest scan and whether the delivery address can still change." },
    { name: "search_help_center(query)", desc: "Searches help articles on policies (returns, refunds, shipping). Not for one specific order." },
  ],
  vague: [
    { name: "fetch(id)", desc: "Fetches data.", real: "get_order_status" },
    { name: "query(text)", desc: "Runs a query.", real: "get_shipment" },
    { name: "lookup(q)", desc: "Looks things up.", real: "search_help_center" },
  ],
};
const DECL_TOKENS = { clear: 210, vague: 45 };
const BASE_TOKENS = 170; // system instruction + the user's message

// Scripts: each model turn is { call, args, result, resultTokens, note } or { answer }.
// A script whose last turn is not an answer repeats its last turn (the model keeps
// retrying), so only the cap can end it.
const SCRIPTS = {
  "order:clear": [
    { call: "get_order_status", args: 'order_id="A1234"', result: '{"status": "shipped", "tracking_id": "T-889"}', resultTokens: 90 },
    { call: "get_shipment", args: 'tracking_id="T-889"', result: '{"last_scan": "left depot 08:10", "address_change": "not possible after dispatch"}', resultTokens: 110 },
    { answer: "Order A1234 has shipped and left the depot at 08:10. The address can no longer be changed, because the order has been dispatched." },
  ],
  "order:vague": [
    { call: "lookup", args: 'q="order A1234 status"', result: '{"article": "How to track an order", "text": "Sign in and open Orders…"}', resultTokens: 150, note: "Nothing says lookup searches help articles, so the model guessed it finds orders." },
    { call: "lookup", args: 'q="A1234 shipping status"', result: '{"article": "How to track an order", "text": "Sign in and open Orders…"}', resultTokens: 150, note: "Same article again. No description points it at fetch, so it rephrases and retries." },
    { call: "lookup", args: 'q="track A1234"', result: '{"article": "How to track an order", "text": "Sign in and open Orders…"}', resultTokens: 150, note: "The loop is not converging: same tool, same result." },
  ],
  "returns:clear": [
    { call: "search_help_center", args: 'query="return policy"', result: '{"article": "Returns", "text": "Unused items within 30 days, with the receipt."}', resultTokens: 120 },
    { answer: "You can return unused items within 30 days if you have the receipt." },
  ],
  "returns:vague": [
    { call: "fetch", args: 'id="return policy"', result: '{"status": "error", "error_message": "unknown order id"}', resultTokens: 40, note: "The name fetch says nothing about what it fetches." },
    { call: "query", args: 'text="return policy"', result: '{"status": "error", "error_message": "tracking_id required"}', resultTokens: 40, note: "Another guess, another error." },
    { call: "lookup", args: 'q="return policy"', result: '{"article": "Returns", "text": "Unused items within 30 days, with the receipt."}', resultTokens: 120, note: "Third guess finds the help center." },
    { answer: "You can return unused items within 30 days if you have the receipt." },
  ],
};

const ANSWER_TOKENS = 60;
const CALL_TOKENS = 25;

let request = "order";
let quality = "clear";
let cap = 6;
let events = []; // shown rows: { kind, who, html }
let modelCalls = 0;
let toolCalls = 0;
let tokens = 0;
let history = 0; // tokens of tool results and calls so far, re-sent on every model call
let phase = "model"; // "model" (next step is a model call) | "tool" (next step runs the proposed call) | "done"
let outcome = null; // "answered" | "capped"
let pendingTurn = null;
let timer = null;
let capReported = false;
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

function script() {
  return SCRIPTS[`${request}:${quality}`];
}

function turnAt(i) {
  const s = script();
  return s[Math.min(i, s.length - 1)];
}

function resetRun() {
  stopAuto();
  events = [{ kind: "user", who: "User", html: esc(REQUESTS[request]) }];
  modelCalls = 0;
  toolCalls = 0;
  tokens = 0;
  history = 0;
  phase = "model";
  outcome = null;
  pendingTurn = null;
}

function step() {
  if (phase === "done") return false;
  if (phase === "model") {
    if (modelCalls >= cap) {
      phase = "done";
      outcome = "capped";
      events.push({ kind: "stop", who: "Runtime", html: `Stopped: another model call would exceed the cap of ${cap}. The user gets no answer.` });
      if (!capReported) {
        capReported = true;
        sim.checkpoint("observe-loop-cap");
      }
      sim.event("loop-capped", { request, quality, cap, tokens });
      return false;
    }
    const turn = turnAt(modelCalls);
    modelCalls += 1;
    const input = BASE_TOKENS + DECL_TOKENS[quality] + history;
    if (turn.answer) {
      tokens += input + ANSWER_TOKENS;
      phase = "done";
      outcome = "answered";
      events.push({ kind: "answer", who: `Model call ${modelCalls}`, html: `Final answer, no tool call: “${esc(turn.answer)}”<span class="note">Read ${input.toLocaleString("en-US")} tokens of context.</span>` });
      sim.event("loop-answered", { request, quality, cap, modelCalls, tokens });
      return false;
    }
    tokens += input + CALL_TOKENS;
    history += CALL_TOKENS;
    pendingTurn = turn;
    phase = "tool";
    const note = turn.note ? ` ${esc(turn.note)}` : "";
    const first = modelCalls === 1 ? " and ends its turn. It runs nothing itself." : ".";
    events.push({ kind: "model", who: `Model call ${modelCalls}`, html: `Proposes <span class="mono">${esc(turn.call)}(${esc(turn.args)})</span>${first}<span class="note">Read ${input.toLocaleString("en-US")} tokens of context.${note}</span>` });
    return true;
  }
  // phase === "tool": the runtime executes the proposed call and appends the result
  toolCalls += 1;
  history += pendingTurn.resultTokens;
  events.push({ kind: "tool", who: "Runtime", html: `Runs <span class="mono">${esc(pendingTurn.call)}</span>, appends the result: <span class="mono">${esc(pendingTurn.result)}</span>` });
  pendingTurn = null;
  phase = "model";
  return true;
}

function stopAuto() {
  if (timer) clearInterval(timer);
  timer = null;
  if (els.auto) els.auto.textContent = "Auto";
}

function startAuto() {
  if (phase === "done") return;
  els.auto.textContent = "Pause";
  timer = setInterval(() => {
    const more = step();
    renderRun();
    if (!more || phase === "done") stopAuto();
  }, 900);
}

function build() {
  app.innerHTML = `
    <div class="controls">
      <label class="field">Request
        <select id="request">
          <option value="order">Order status (two tools)</option>
          <option value="returns">Return policy (one tool)</option>
        </select>
      </label>
      <label class="field">Tool descriptions
        <select id="quality">
          <option value="clear">Clear names and descriptions</option>
          <option value="vague">Vague names and descriptions</option>
        </select>
      </label>
      <label class="field" for="cap"><span class="nowrap">Max model calls: <span id="capval"></span></span>
        <input id="cap" type="range" min="2" max="10" step="1" />
      </label>
      <div class="buttons">
        <button id="step">Step</button>
        <button id="auto" class="secondary">Auto</button>
        <button id="reset" class="secondary">Reset</button>
      </div>
    </div>
    <p class="readout" id="readout" role="status"></p>
    <section class="decls" aria-labelledby="decls-h">
      <h2 id="decls-h">Tool declarations the model sees</h2>
      <ul id="decls"></ul>
    </section>
    <section class="transcript" aria-labelledby="tr-h">
      <h2 id="tr-h">The loop, step by step</h2>
      <div class="logbox" id="logbox" tabindex="0" role="region" aria-label="The loop, step by step"><ol id="rows"></ol></div>
    </section>
    <p class="legend">Model rows propose; runtime rows execute. Token counts are illustrative.</p>`;
  els = {
    request: app.querySelector("#request"),
    quality: app.querySelector("#quality"),
    cap: app.querySelector("#cap"),
    capval: app.querySelector("#capval"),
    step: app.querySelector("#step"),
    auto: app.querySelector("#auto"),
    reset: app.querySelector("#reset"),
    decls: app.querySelector("#decls"),
    rows: app.querySelector("#rows"),
    logbox: app.querySelector("#logbox"),
    readout: app.querySelector("#readout"),
  };
  els.request.value = request;
  els.quality.value = quality;
  els.cap.value = String(cap);
  els.request.addEventListener("change", () => { request = els.request.value; resetRun(); renderAll(); });
  els.quality.addEventListener("change", () => { quality = els.quality.value; resetRun(); renderAll(); });
  els.cap.addEventListener("input", () => { cap = Number(els.cap.value); resetRun(); renderAll(); });
  els.step.addEventListener("click", () => { stopAuto(); step(); renderRun(); });
  els.auto.addEventListener("click", () => { if (timer) stopAuto(); else startAuto(); });
  els.reset.addEventListener("click", () => { resetRun(); renderAll(); });
}

function renderDecls() {
  const reveal = phase === "done";
  els.decls.innerHTML = DECLS[quality]
    .map((d) => `<li><span class="mono name">${esc(d.name)}</span>: ${esc(d.desc)}${reveal && d.real ? ` <span class="real">(really <span class="mono">${esc(d.real)}</span>)</span>` : ""}</li>`)
    .join("");
}

function renderRun() {
  const rows = events.map((e) => `<li class="row ${e.kind}"><span class="who">${esc(e.who)}</span><span>${e.html}</span></li>`);
  if (phase !== "done") {
    const next = phase === "model" ? (modelCalls >= cap ? "the cap check" : `model call ${modelCalls + 1}`) : "the runtime executing the proposed call";
    rows.push(`<li class="pending">Next: ${next}. Press Step or Auto.</li>`);
  }
  els.rows.innerHTML = rows.join("");
  // Fit the screen: the transcript scrolls in its own region; keep its newest row in view.
  els.logbox.scrollTop = els.logbox.scrollHeight;
  renderDecls();
  els.capval.textContent = String(cap);
  const counts = `Model calls: ${modelCalls} of ${cap} · tool calls run: ${toolCalls} · tokens so far: ${tokens.toLocaleString("en-US")}`;
  els.readout.className = `readout${outcome === "capped" ? " stopped" : outcome === "answered" ? " done" : ""}`;
  els.readout.textContent =
    outcome === "answered" ? `Answered. ${counts}.`
    : outcome === "capped" ? `Stopped by the cap, no answer. ${counts}.`
    : `${counts}.`;
  reportSize();
}

function renderAll() {
  renderDecls();
  renderRun();
}

function readProps(props) {
  if (props && REQUESTS[props.request]) request = props.request;
  if (props && DECLS[props.descriptions]) quality = props.descriptions;
  const n = Number(props && props.cap);
  if (Number.isFinite(n) && n >= 2 && n <= 10) cap = Math.floor(n);
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
