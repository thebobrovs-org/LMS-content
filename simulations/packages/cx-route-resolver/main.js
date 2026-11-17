// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// A small Dialogflow CX-style flow (the kind CX Agent Studio imports as a flow-based
// agent) and the documented order in which state handlers are evaluated after one
// user turn:
//   phase 1: routes with an intent requirement, page level then flow level;
//   phase 2: routes with only a condition, page level, then flow level only on the
//            start page;
//   phase 3: event handlers for the event raised (no-match, no-input), page level then
//            flow level.
// A called handler with a transition target ends evaluation. Intents and events are
// consumed by the first handler that matches them. Everything is deterministic.

const app = document.getElementById("app");

const PAGES = {
  start: "Start page",
  amount: "Collect amount",
  confirm: "Confirm payment",
};

const INPUTS = {
  balance: { text: "What do I owe?", intent: "billing.check_balance" },
  person: { text: "Can I talk to a person?", intent: "agent.handoff" },
  pay: { text: "I'll pay 50 dollars", intent: "payment.amount" },
  yes: { text: "Yes", intent: "confirm.yes" },
  no: { text: "No", intent: "confirm.no" },
  unclear: { text: "Hmm, the thing from last week", intent: null },
  silence: { text: "(no reply)", intent: null, silent: true },
};

// Handlers. kind: "intent" route, "cond" (condition-only) route, or "event" handler.
const FLOW_ROUTES = [
  { id: "f1", kind: "intent", intent: "agent.handoff", target: "hand off to a person (END_FLOW_WITH_HUMAN_ESCALATION)" },
  { id: "f2", kind: "intent", intent: "billing.check_balance", target: "Read balance page" },
  { id: "f3", kind: "cond", cond: "$session.params.balance_due > 0", test: (s) => s.balance > 0, target: "Collect amount page" },
];
const PAGE_ROUTES = {
  start: [],
  amount: [
    { id: "a1", kind: "intent", intent: "payment.amount", target: "Confirm payment page" },
    { id: "a2", kind: "cond", cond: "$session.params.balance_due = 0", test: (s) => s.balance === 0, target: "Nothing owed page" },
  ],
  confirm: [
    { id: "c1", kind: "intent", intent: "confirm.yes", target: "END_SESSION (payment taken)" },
    { id: "c2", kind: "intent", intent: "confirm.no", target: "Collect amount page" },
  ],
};
const PAGE_EVENTS = {
  start: [],
  amount: [],
  confirm: [{ id: "ce1", kind: "event", event: "sys.no-match-default", say: "Please answer yes or no." }],
};
const FLOW_EVENTS = [
  { id: "fe1", kind: "event", event: "sys.no-match-default", say: "Sorry, I didn't catch that." },
  { id: "fe2", kind: "event", event: "sys.no-input-default", say: "Are you still there?" },
];

let page = "confirm";
let balance = 120;
let input = "unclear";
let list = []; // evaluation rows: { h, level, phase, inScope, result, cls }
let cursor = 0; // rows evaluated so far
let done = false;
let winner = null; // { row, message }: the handler that decided the turn
let consumed = null; // the event already taken by a handler without a transition
let scopeSeen = false;
let timer = null;
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

function requirement(h) {
  if (h.kind === "intent") return `Intent <span class="mono">${esc(h.intent)}</span>`;
  if (h.kind === "cond") return `Condition <span class="mono">${esc(h.cond)}</span>`;
  return `Event <span class="mono">${esc(h.event)}</span>`;
}

function owner(row) {
  return row.level === "Flow" ? "The flow's" : `The ${row.level} page's`;
}

function outcome(h) {
  return h.target ? `→ ${esc(h.target)}` : `says “${esc(h.say)}”`;
}

// Build the ordered list of every handler, in scope or not, for the three phases.
function buildList() {
  const onStart = page === "start";
  const rows = [];
  const pageName = PAGES[page];
  for (const h of PAGE_ROUTES[page].filter((r) => r.kind === "intent")) rows.push({ h, level: pageName, phase: 1, inScope: true });
  for (const h of FLOW_ROUTES.filter((r) => r.kind === "intent")) rows.push({ h, level: "Flow", phase: 1, inScope: true });
  for (const h of PAGE_ROUTES[page].filter((r) => r.kind === "cond")) rows.push({ h, level: pageName, phase: 2, inScope: true });
  for (const h of FLOW_ROUTES.filter((r) => r.kind === "cond")) rows.push({ h, level: "Flow", phase: 2, inScope: onStart });
  for (const h of PAGE_EVENTS[page]) rows.push({ h, level: pageName, phase: 3, inScope: true });
  for (const h of FLOW_EVENTS) rows.push({ h, level: "Flow", phase: 3, inScope: true });
  return rows;
}

function resetRun() {
  stopAuto();
  list = buildList();
  cursor = 0;
  done = false;
  winner = null;
  consumed = null;
  list.forEach((r) => { r.result = "waiting"; r.cls = r.inScope ? "wait" : "out"; });
}

// The event this turn raises if no route transitions: no-input for silence, no-match
// when no in-scope intent route matched the input (or it matched no intent at all).
function raisedEvent() {
  const inp = INPUTS[input];
  if (inp.silent) return "sys.no-input-default";
  const matched = list.some((r) => r.phase === 1 && r.inScope && r.h.intent === inp.intent);
  return matched ? null : "sys.no-match-default";
}

function evaluate(row) {
  const inp = INPUTS[input];
  const s = { balance };
  const h = row.h;
  if (!row.inScope) {
    row.cls = "out";
    row.result = "Out of scope: flow condition routes only run on the start page";
    if (page !== "start" && balance > 0 && h.id === "f3" && !scopeSeen) {
      scopeSeen = true;
      sim.checkpoint("observe-route-scope");
      sim.event("route-out-of-scope", { page, balance, input });
    }
    return false;
  }
  if (h.kind === "intent") {
    if (inp.intent && h.intent === inp.intent) {
      row.cls = "fire";
      row.result = `Matches, fires ${outcome(h)}`;
      winner = { row, message: `${owner(row)} intent route fires ${outcome(h)}.` };
      return true;
    }
    row.cls = "miss";
    row.result = inp.silent ? "No input to match" : "Intent doesn't match";
    return false;
  }
  if (h.kind === "cond") {
    if (h.test(s)) {
      row.cls = "fire";
      row.result = `True, fires ${outcome(h)}`;
      winner = { row, message: `${owner(row)} condition route fires ${outcome(h)}.` };
      return true;
    }
    row.cls = "miss";
    row.result = "Condition is false";
    return false;
  }
  // event handler
  const ev = raisedEvent();
  if (ev && h.event === ev && consumed !== ev) {
    row.cls = "fire";
    row.result = `Event raised, ${outcome(h)}`;
    winner = { row, message: `${owner(row)} event handler ${h.event} fires and ${outcome(h)}` };
    consumed = ev; // later handlers for this event are not called
    return Boolean(h.target); // no transition target: evaluation continues
  }
  row.cls = "miss";
  row.result = !ev ? "No event raised" : h.event === ev ? "Event already consumed" : "Not this event";
  return false;
}

function step() {
  if (done) return false;
  const row = list[cursor];
  const ended = evaluate(row);
  cursor += 1;
  if (ended) {
    for (let i = cursor; i < list.length; i++) {
      list[i].cls = list[i].inScope ? "skip" : "out";
      list[i].result = list[i].inScope ? "Not reached: evaluation ended" : "Out of scope: flow condition routes only run on the start page";
    }
    done = true;
    sim.event("route-resolved", { page, balance, input, winner: row.h.id });
  } else if (cursor >= list.length) {
    done = true;
    if (winner) sim.event("route-resolved", { page, balance, input, winner: winner.row.h.id });
  }
  return !done;
}

function stopAuto() {
  if (timer) clearInterval(timer);
  timer = null;
  if (els.auto) els.auto.textContent = "Auto";
}

function startAuto() {
  if (done) return;
  els.auto.textContent = "Pause";
  timer = setInterval(() => {
    const more = step();
    renderRun();
    if (!more) stopAuto();
  }, 700);
}

function options(map, label) {
  return Object.entries(map).map(([k, v]) => `<option value="${k}">${esc(label(v))}</option>`).join("");
}

function build() {
  app.innerHTML = `
    <div class="controls">
      <label class="field">Active page
        <select id="page">${options(PAGES, (v) => v)}</select>
      </label>
      <label class="field">Session parameter balance_due
        <select id="balance"><option value="120">120 (money owed)</option><option value="0">0 (nothing owed)</option></select>
      </label>
      <label class="field">User says
        <select id="input">${options(INPUTS, (v) => (v.intent ? `“${v.text}” (${v.intent})` : v.silent ? v.text : `“${v.text}” (no intent)`))}</select>
      </label>
      <div class="buttons">
        <button id="step">Step</button>
        <button id="auto" class="secondary">Auto</button>
        <button id="reset" class="secondary">Reset</button>
      </div>
    </div>
    <div id="phases"></div>
    <p class="readout" id="readout" role="status"></p>
    <p class="legend">Handlers are evaluated top to bottom. A handler with a transition ends the evaluation; an intent or event is consumed by the first handler that takes it; dashed rows are out of scope on this page. One turn only: in a live flow, condition routes also run when a page is entered.</p>`;
  els = {
    page: app.querySelector("#page"),
    balance: app.querySelector("#balance"),
    input: app.querySelector("#input"),
    step: app.querySelector("#step"),
    auto: app.querySelector("#auto"),
    reset: app.querySelector("#reset"),
    phases: app.querySelector("#phases"),
    readout: app.querySelector("#readout"),
  };
  els.page.value = page;
  els.balance.value = String(balance);
  els.input.value = input;
  els.page.addEventListener("change", () => { page = els.page.value; resetRun(); renderRun(); });
  els.balance.addEventListener("change", () => { balance = Number(els.balance.value); resetRun(); renderRun(); });
  els.input.addEventListener("change", () => { input = els.input.value; resetRun(); renderRun(); });
  els.step.addEventListener("click", () => { stopAuto(); step(); renderRun(); });
  els.auto.addEventListener("click", () => { if (timer) stopAuto(); else startAuto(); });
  els.reset.addEventListener("click", () => { resetRun(); renderRun(); });
}

const PHASE_TITLES = {
  1: "Phase 1: routes with an intent",
  2: "Phase 2: routes with only a condition",
  3: "Phase 3: event handlers",
};

function renderRun() {
  let html = "";
  for (const ph of [1, 2, 3]) {
    const rows = list.map((r, i) => ({ r, i })).filter(({ r }) => r.phase === ph);
    if (!rows.length) continue;
    html += `<section class="phase" aria-label="${PHASE_TITLES[ph]}"><h2>${PHASE_TITLES[ph]}</h2><ol>`;
    for (const { r, i } of rows) {
      const cur = !done && i === cursor ? " cur" : "";
      html += `<li class="h ${r.cls}${cur}"><span class="lvl">${esc(r.level)}</span><span class="req">${requirement(r.h)}<span class="tgt">${outcome(r.h)}</span></span><span class="res">${r.result === "waiting" ? (i === cursor && !done ? "Next" : "Waiting") : r.result}</span></li>`;
    }
    html += "</ol></section>";
  }
  els.phases.innerHTML = html;
  const hadFocus = document.activeElement === els.step || document.activeElement === els.auto;
  els.step.disabled = done;
  els.auto.disabled = done;
  if (done && hadFocus) els.reset.focus();
  const ev = raisedEvent();
  const head = `${PAGES[page]} · ${INPUTS[input].silent ? "no reply" : `“${INPUTS[input].text}”`} ·`;
  if (done && winner) {
    const f3i = list.findIndex((r) => r.h.id === "f3");
    const f3 = list[f3i];
    const note = !f3.inScope && balance > 0 && list.indexOf(winner.row) > f3i ? " The flow's balance_due route was true but out of scope, because this is not the start page." : "";
    els.readout.className = "readout done";
    els.readout.textContent = `${head} ${winner.message.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[m] || m)}${note}`;
  } else if (done) {
    els.readout.className = "readout";
    els.readout.textContent = `${head} No handler fired, so the agent stays on the page.`;
  } else {
    els.readout.className = "readout";
    els.readout.textContent = `${head} ${cursor} of ${list.length} handlers evaluated${ev ? `; if no route fires, ${ev} is raised` : ""}. Press Step or Auto.`;
  }
  reportSize();
}

function readProps(props) {
  if (props && PAGES[props.page]) page = props.page;
  const b = Number(props && props.balance);
  if (b === 0 || b === 120) balance = b;
  if (props && INPUTS[props.input]) input = props.input;
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
