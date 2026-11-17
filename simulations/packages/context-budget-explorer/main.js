// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// One late turn of the lesson's support agent, as a token budget. Each control cuts one
// component the way the lesson describes (tool_filter, history compaction, load_memory,
// reranking), and the lesson's three evalset cases show whether the evidence each one
// needs is still in the context. Context caching changes what the stable prefix costs,
// not how many tokens the model reads. Token counts are the lesson's illustrative
// numbers; the cached-input rate is a tenth of the standard rate (Gemini 3.5 Flash list
// price, retrieved 2026-11-17); explicit-cache storage is not counted. Deterministic.

const app = document.getElementById("app");

const BEFORE = 47000;
const COMPONENTS = [
  { id: "instructions", label: "Instructions", cls: "c-ins" },
  { id: "tools", label: "Tool declarations", cls: "c-tools" },
  { id: "history", label: "History", cls: "c-hist" },
  { id: "memory", label: "Memory", cls: "c-mem" },
  { id: "retrieved", label: "Retrieved chunks", cls: "c-ret" },
];

const CHOICES = {
  tools: {
    all: { label: "All 40 tools", tokens: 10000, warranty: true },
    filtered: { label: "tool_filter: the 8 the agent needs", tokens: 2000, warranty: true },
    careless: { label: "tool_filter: 8 tools, check_warranty left out", tokens: 2000, warranty: false },
  },
  history: {
    raw: { label: "Every event, raw", tokens: 18000, orderId: "history" },
    compacted: { label: "Compacted; order id only in history", tokens: 4000, orderId: null },
    state: { label: "Compacted; order id in session state", tokens: 4000, orderId: "state" },
  },
  memory: {
    preload: { label: "preload_memory on every call", tokens: 6000 },
    load: { label: "load_memory on demand (~1,500, assumed)", tokens: 1500 },
  },
  retrieved: {
    top10: { label: "Top 10 chunks", tokens: 10000, returnChunk: 7 },
    top5: { label: "Top 5 chunks, no reranker", tokens: 5000, returnChunk: null },
    rerank5: { label: "Rerank, then top 5", tokens: 5000, returnChunk: 2 },
  },
};
const INSTRUCTIONS = 3000;
const CACHED_RATE = 0.1;

let pick = { tools: "all", history: "raw", memory: "preload", retrieved: "top10" };
let cache = false;
let reported = false;
let els = {};

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const fmt = (n) => n.toLocaleString("en-US");

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

function tokens() {
  return {
    instructions: INSTRUCTIONS,
    tools: CHOICES.tools[pick.tools].tokens,
    history: CHOICES.history[pick.history].tokens,
    memory: CHOICES.memory[pick.memory].tokens,
    retrieved: CHOICES.retrieved[pick.retrieved].tokens,
  };
}

// The lesson's three evalset cases, and the evidence each needs in the context.
function evalCases() {
  const t = CHOICES.tools[pick.tools];
  const h = CHOICES.history[pick.history];
  const r = CHOICES.retrieved[pick.retrieved];
  const recallProblems = [];
  if (!r.returnChunk) recallProblems.push("turn 2: the return-policy chunk ranked 7th by similarity, so top 5 without a reranker dropped it");
  if (!h.orderId) recallProblems.push("turn 3: the summary dropped order id C9012");
  return [
    {
      id: "refund_status",
      pass: true,
      why: "get_refund_status is declared in every option.",
    },
    {
      id: "warranty_question",
      pass: t.warranty,
      why: t.warranty ? "check_warranty is declared." : "check_warranty is not declared, so the agent cannot call it.",
    },
    {
      id: "long_session_recall",
      pass: recallProblems.length === 0,
      why: recallProblems.length
        ? `Fails at ${recallProblems.join("; and ")}.`
        : `Return-policy chunk at rank ${r.returnChunk}; order id C9012 ${h.orderId === "state" ? "in session state, outside the summary" : "still in the raw history"}.`,
    },
  ];
}

function build() {
  const sel = (id, label) => `
      <label class="field">${label}
        <select id="${id}">
          ${Object.entries(CHOICES[id]).map(([k, c]) => `<option value="${k}">${esc(c.label)}</option>`).join("")}
        </select>
      </label>`;
  app.innerHTML = `
    <div class="controls">
      ${sel("tools", "Tool declarations")}
      ${sel("history", "History")}
      ${sel("memory", "Memory")}
      ${sel("retrieved", "Retrieved content")}
      <label class="check"><input type="checkbox" id="cache" /> Context caching on the stable prefix</label>
      <div class="buttons"><button id="reset" class="secondary">Reset</button></div>
    </div>
    <section class="budget" aria-labelledby="budget-h">
      <h2 id="budget-h">Tokens in one late turn</h2>
      <div class="barrow"><span class="barlabel">Before any cut</span><div class="bar" id="before" aria-hidden="true"></div><span class="mono total">${fmt(BEFORE)}</span></div>
      <div class="barrow"><span class="barlabel">Now</span><div class="bar" id="now" aria-hidden="true"></div><span class="mono total" id="nowtotal"></span></div>
      <ul class="parts" id="parts"></ul>
    </section>
    <section class="evals" aria-labelledby="evals-h">
      <h2 id="evals-h">The evalset: is the evidence each case needs still there?</h2>
      <ul id="cases"></ul>
    </section>
    <p class="readout" id="readout" role="status"></p>
    <p class="legend">Token counts are the lesson's illustrative figures. Hatching marks the cached prefix: still in the context window, billed at a tenth of the input rate. The fixture's chunk ranks are invented for the exercise.</p>`;
  els = {};
  for (const id of ["tools", "history", "memory", "retrieved", "cache", "reset", "before", "now", "nowtotal", "parts", "cases", "readout"]) {
    els[id] = app.querySelector(`#${id}`);
  }
  for (const k of Object.keys(CHOICES)) {
    els[k].addEventListener("change", () => { pick[k] = els[k].value; sim.event("cut-changed", { component: k, choice: pick[k] }); render(); });
  }
  els.cache.addEventListener("change", () => { cache = els.cache.checked; sim.event("cache-toggled", { cache }); render(); });
  els.reset.addEventListener("click", () => {
    pick = { tools: "all", history: "raw", memory: "preload", retrieved: "top10" };
    cache = false;
    render();
  });
  els.before.innerHTML = segments({ instructions: 3000, tools: 10000, history: 18000, memory: 6000, retrieved: 10000 }, false);
}

function segments(t, hatch) {
  return COMPONENTS.map((c) => {
    const pct = (t[c.id] / BEFORE) * 100;
    const cached = hatch && (c.id === "instructions" || c.id === "tools");
    return `<span class="seg ${c.cls}${cached ? " cached" : ""}" style="width:${pct.toFixed(2)}%"></span>`;
  }).join("");
}

function render() {
  for (const k of Object.keys(CHOICES)) els[k].value = pick[k];
  els.cache.checked = cache;
  const t = tokens();
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  const prefix = t.instructions + t.tools;
  const billed = cache ? total - prefix + prefix * CACHED_RATE : total;
  els.now.innerHTML = segments(t, cache);
  els.nowtotal.textContent = fmt(total);
  const base = { instructions: 3000, tools: 10000, history: 18000, memory: 6000, retrieved: 10000 };
  els.parts.innerHTML = COMPONENTS.map((c) => {
    const d = t[c.id] - base[c.id];
    const cached = cache && (c.id === "instructions" || c.id === "tools") ? " · cached" : "";
    return `<li><span class="sw ${c.cls}" aria-hidden="true"></span>${esc(c.label)}: <span class="mono">${fmt(t[c.id])}</span>${d ? ` <span class="delta">(${fmt(d)})</span>` : ""}${cached}</li>`;
  }).join("");

  const cases = evalCases();
  const passed = cases.filter((c) => c.pass).length;
  els.cases.innerHTML = cases.map((c) => `<li class="case ${c.pass ? "pass" : "fail"}"><span class="mono id">${c.id}</span><span class="verdict">${c.pass ? "✓ Pass" : "✗ Fail"}</span><span class="why">${esc(c.why)}</span></li>`).join("");

  const cost = cache ? ` · billed like ${fmt(Math.round(billed))} uncached input tokens (cache shrinks the bill, not the context)` : "";
  els.readout.className = `readout${passed === 3 && total <= 21000 ? " done" : passed < 3 ? " stopped" : ""}`;
  els.readout.textContent = `Context: ${fmt(total)} tokens per late turn (was ${fmt(BEFORE)})${cost} · evalset: ${passed} of 3 cases pass.`;

  if (!reported && passed === 3 && total <= 21000) {
    reported = true;
    sim.checkpoint("observe-evidence-survives");
    sim.event("lean-and-passing", { total, pick, cache });
  }
  reportSize();
}

const sim = createSim({
  onInit({ theme }) {
    applyTheme(theme);
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
