// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// Pack the backpack, keep the gems. One late turn of the lesson's support agent is a
// backpack that holds 47,000 tokens, stacked by component. Each cut shrinks one block the
// way the lesson describes (tool_filter, history compaction, load_memory, top-k and
// reranking), and three gems ride inside: the evidence each evalset case needs (the
// check_warranty declaration, order id C9012 in the history, the return-policy fact in
// retrieved chunk 7). A careless cut drops a gem into the "lost" tray and its case fails.
// Context caching changes what the stable prefix costs, not how many tokens the model
// reads. Token counts are the lesson's illustrative numbers; the cached-input rate is a
// tenth of the standard rate (Gemini 3.5 Flash list price, retrieved 2026-11-17);
// explicit-cache storage is not counted. Deterministic.
//
// Guided mode (props.mode "guided", the embed near the top of the lesson, in place of the figure
// media/context-budget.svg): the same backpack, stepped through the figure's rows in order (before, filter
// tools, compact history, recall memory on demand, then caching). No gems, goal line or evalset: the
// challenge stays in the default mode at the end of the lesson. A small predict card asks what caching does
// to the token count; guided mode fires only its own checkpoint, observe-cuts-then-cache.

const app = document.getElementById("app");

const BEFORE = 47000;
const GOAL = 21000;
const CACHED_RATE = 0.1;
const COMPONENTS = [
  { id: "instructions", label: "Instructions", cls: "c-ins" },
  { id: "tools", label: "Tool declarations", cls: "c-tools" },
  { id: "history", label: "History", cls: "c-hist" },
  { id: "memory", label: "Memory", cls: "c-mem" },
  { id: "retrieved", label: "Retrieved chunks", cls: "c-ret" },
];
const TOOLS = {
  all: { label: "All 40 tools", tokens: 10000, warranty: true },
  filtered: { label: "tool_filter: the 8 it needs", tokens: 2000, warranty: true },
  careless: { label: "tool_filter: 8, check_warranty left out", tokens: 2000, warranty: false },
};
const MEMORY = {
  preload: { label: "preload_memory every call", tokens: 6000 },
  load: { label: "load_memory on demand", tokens: 1500 },
};
// Retrieved chunks in similarity order; the return-policy chunk is 7th by similarity and
// 2nd after reranking (the fixture's ranks are invented for the exercise).
const CHUNKS = ["Shipping times", "Gift cards", "Warranty terms", "Store hours", "Order tracking", "Price match", "Return policy", "Loyalty points", "Size guide", "Careers"];
const RERANKED = [0, 6, 2, 4, 1, 5, 3, 7, 8, 9];
const RETURN_CHUNK = 6;
const PREDICT = { refund_status: "refund_status", warranty_question: "warranty_question", long_session_recall: "long_session_recall", none: "None" };

// Drawing (viewBox 760 x 430): the backpack holds BEFORE tokens in its full height.
const BAG = { x: 70, y: 70, w: 220, h: 330 };
const PX = BAG.h / BEFORE;
const TRAY = { x: 560, y: 330, w: 180, h: 74 };

const START = { tools: "all", compact: false, pin: false, memory: "preload", topk: 10, rerank: false, cache: false };
let pick = { ...START };
let prediction = null;
let sawCompactLoss = false; // the learner compacted without pinning at least once
let reported = false;
let reduced = false;
let els = {};
let guided = false;
let gstep = 0;
let gpick = null;
let gfired = false;

// Guided mode: the figure's rows, each keeping the cuts before it.
const GSTEPS = [
  { label: "Before", row: "Before any cut", pick: {}, text: "One late turn of the support agent: 47,000 tokens before the user's message, and history is the largest part. Press Step to make the first cut." },
  { label: "Filter tools", row: "Filter tools", delta: "tool declarations 10k → 2k", pick: { tools: "filtered" }, text: "A tool_filter exposes the 8 tools the agent needs instead of 40. Tool declarations drop from 10,000 to about 2,000 tokens." },
  { label: "Compact history", row: "Compact history", delta: "history 18k → 4k", pick: { compact: true }, text: "History compaction summarises older events and keeps the most recent ones as they were. History drops from 18,000 to 4,000 tokens." },
  { label: "Memory on demand", row: "Recall memory on demand", delta: "memory 6k → 1.5k*", pick: { memory: "load" }, text: "load_memory recalls memory only on the turns that ask, instead of preload_memory on every call. Memory drops from 6,000 to about 1,500 tokens, assuming compaction soon summarises each recalled result." },
  { label: "Cache the prefix", row: "Then cache the prefix", delta: "5k prefix cached", pick: { cache: true }, text: "Context caching reuses the stable prefix: instructions and tool declarations, 5,000 tokens. It costs less and is processed faster, but it still counts in the context window." },
];
const GPREDICT = {
  question: "After the three cuts, you cache the 5,000-token prefix. How many tokens does the model read?",
  options: [["same", "Still 20,500"], ["less", "15,500, without the prefix"]],
  answer: "same",
  why: "Caching makes the prefix cheaper and faster, not smaller: the cached tokens still count in the context window.",
};

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const fmt = (n) => Math.round(n).toLocaleString("en-US");

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

function tokens() {
  return {
    instructions: 3000,
    tools: TOOLS[pick.tools].tokens,
    history: pick.compact ? 4000 : 18000,
    memory: MEMORY[pick.memory].tokens,
    retrieved: pick.topk * 1000,
  };
}

// The chunks the agent receives, in the order it receives them.
function chunkOrder() {
  return pick.rerank ? RERANKED : CHUNKS.map((_, i) => i);
}

function returnRank() {
  const r = chunkOrder().indexOf(RETURN_CHUNK) + 1;
  return r <= pick.topk ? r : null;
}

// Where each gem is now: "bag" (in its block), "pocket" (session state) or "lost".
function gems() {
  return {
    warranty: TOOLS[pick.tools].warranty ? "bag" : "lost",
    order: !pick.compact ? "bag" : pick.pin ? "pocket" : "lost",
    policy: returnRank() ? "bag" : "lost",
  };
}

function evalCases() {
  const g = gems();
  const recall = [];
  if (g.policy === "lost") recall.push("turn 2 needs the return-policy chunk, ranked 7th by similarity, so top 5 without a reranker drops it");
  if (g.order === "lost") recall.push("turn 3 needs order id C9012, and the summary dropped it");
  return [
    { id: "refund_status", pass: true, why: "get_refund_status is declared in every option." },
    { id: "warranty_question", pass: g.warranty !== "lost", why: g.warranty !== "lost" ? "check_warranty is declared." : "check_warranty is not declared, so the agent cannot call it." },
    {
      id: "long_session_recall",
      pass: recall.length === 0,
      why: recall.length
        ? `Fails: ${recall.join("; and ")}.`
        : `Return-policy chunk at rank ${returnRank()}; order id C9012 ${g.order === "pocket" ? "pinned in session state, outside the summary" : "still in the raw history"}.`,
    },
  ];
}

// ---- Drawing --------------------------------------------------------------------------------

function blockLayout(t) {
  const out = {};
  let y = BAG.y + BAG.h;
  for (const c of COMPONENTS) {
    const h = t[c.id] * PX;
    y -= h;
    out[c.id] = { y, h };
  }
  return out;
}

function gemPos(name, where, lay) {
  const lost = { warranty: 0, order: 1, policy: 2 }[name];
  if (where === "lost") return { x: TRAY.x + 30 + lost * 60, y: TRAY.y + 30 };
  if (where === "pocket") return { x: BAG.x + BAG.w + 28, y: BAG.y + 150 };
  const block = { warranty: "tools", order: "history", policy: "retrieved" }[name];
  const b = lay[block];
  return { x: BAG.x + BAG.w - 22, y: b.y + Math.min(b.h / 2, 30) + 2 };
}

function buildScene() {
  if (guided) return buildGuidedScene();
  els.svg.innerHTML = `
    <defs>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" class="hatchline"/></pattern>
    </defs>
    <text class="h" x="${BAG.x + BAG.w / 2}" y="26">One late turn's context</text>
    <path class="strap" d="M${BAG.x + 50} ${BAG.y} Q${BAG.x + BAG.w / 2} ${BAG.y - 46} ${BAG.x + BAG.w - 50} ${BAG.y}"/>
    <rect class="bag" x="${BAG.x - 8}" y="${BAG.y - 8}" width="${BAG.w + 16}" height="${BAG.h + 16}" rx="22"/>
    <g id="blocks">${COMPONENTS.map((c) => `<g class="blk ${c.cls}" id="b-${c.id}"><rect x="${BAG.x}" width="${BAG.w}" rx="4"/><rect class="hatch" x="${BAG.x}" width="${BAG.w}" rx="4" fill="url(#hatch)"/><text class="bl" x="${BAG.x + 10}"></text><text class="bt" x="${BAG.x + 10}"></text></g>`).join("")}</g>
    <g class="goal"><line x1="${BAG.x - 8}" x2="${BAG.x + BAG.w + 26}" y1="${BAG.y + BAG.h - GOAL * PX}" y2="${BAG.y + BAG.h - GOAL * PX}"/><text x="${BAG.x - 12}" y="${BAG.y + BAG.h - GOAL * PX + 4}">goal 21k</text></g>
    <g class="pocket"><rect x="${BAG.x + BAG.w + 8}" y="${BAG.y + 118}" width="46" height="62" rx="8"/><text x="${BAG.x + BAG.w + 31}" y="${BAG.y + 196}">state</text></g>
    <text class="h" x="${CH.x + CH.w / 2}" y="26">Retrieved chunks, in the order the agent gets them</text>
    <g id="chunks"></g>
    <rect class="tray" x="${TRAY.x}" y="${TRAY.y}" width="${TRAY.w}" height="${TRAY.h}" rx="10"/>
    <text class="h" x="${TRAY.x + TRAY.w / 2}" y="${TRAY.y - 10}">Lost on the way</text>
    <g id="gems">${["warranty", "order", "policy"].map((g) => `<g class="gem" id="g-${g}"><path d="M0 -11 L10 -2 L0 12 L-10 -2 Z"/><text y="27">${{ warranty: "warranty", order: "C9012", policy: "policy" }[g]}</text></g>`).join("")}</g>`;
  els.blocks = {};
  for (const c of COMPONENTS) els.blocks[c.id] = els.svg.querySelector(`#b-${c.id}`);
  els.chunks = els.svg.querySelector("#chunks");
  els.gems = {};
  for (const g of ["warranty", "order", "policy"]) els.gems[g] = els.svg.querySelector(`#g-${g}`);
}

const CH = { x: 380, y: 44, w: 150, row: 26 };

function drawScene() {
  const t = tokens();
  const lay = blockLayout(t);
  drawBlocks(t, lay);
  if (guided) drawGuidedScene(t);
  else drawRest(t, lay);
}

function drawBlocks(t, lay) {
  for (const c of COMPONENTS) {
    const g = els.blocks[c.id];
    const { y, h } = lay[c.id];
    for (const r of g.querySelectorAll("rect")) { r.setAttribute("y", y.toFixed(1)); r.setAttribute("height", Math.max(h - 2, 1).toFixed(1)); }
    const cached = pick.cache && (c.id === "instructions" || c.id === "tools");
    g.querySelector(".hatch").setAttribute("opacity", cached ? "1" : "0");
    const [bl, bt] = g.querySelectorAll("text");
    const big = h >= 34;
    bl.setAttribute("y", (y + (big ? 17 : h / 2 + 3.5)).toFixed(1));
    bl.setAttribute("class", big ? "bl" : "bl small");
    bl.textContent = big ? c.label : `${c.label} ${t[c.id] / 1000}k`;
    bt.setAttribute("y", (y + 31).toFixed(1));
    bt.textContent = big ? `${fmt(t[c.id])} tokens${cached ? " · cached" : ""}` : "";
  }
}

function drawRest(t, lay) {
  const order = chunkOrder();
  els.chunks.innerHTML = order.map((ci, i) => {
    const y = CH.y + i * CH.row;
    const kept = i < pick.topk;
    const gem = ci === RETURN_CHUNK;
    return `<g class="chunk${kept ? " kept" : " out"}${gem ? " gemchunk" : ""}">
      <rect x="${CH.x}" y="${y}" width="${CH.w}" height="${CH.row - 4}" rx="4"/>
      <text class="cr" x="${CH.x + 8}" y="${y + 15}">#${i + 1}</text>
      <text class="cn" x="${CH.x + 34}" y="${y + 15}">${esc(CHUNKS[ci])}${gem ? " ◆" : ""}</text>
    </g>`;
  }).join("") + `<line class="cut" x1="${CH.x - 6}" x2="${CH.x + CH.w + 6}" y1="${CH.y + pick.topk * CH.row - 2}" y2="${CH.y + pick.topk * CH.row - 2}"/>
    <text class="cutl" x="${CH.x + CH.w + 10}" y="${CH.y + pick.topk * CH.row + 2}">top ${pick.topk}</text>`;
  const g = gems();
  for (const name of ["warranty", "order", "policy"]) {
    const p = gemPos(name, g[name], lay);
    const el = els.gems[name];
    el.setAttribute("transform", `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`);
    el.setAttribute("class", `gem ${g[name]}`);
  }
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  const lost = Object.entries(g).filter(([, w]) => w === "lost").map(([n]) => ({ warranty: "the check_warranty declaration", order: "order id C9012", policy: "the return-policy chunk" }[n]));
  els.svg.setAttribute("aria-label", `The backpack holds ${fmt(total)} of the original ${fmt(BEFORE)} tokens. ${lost.length ? `Lost: ${lost.join(", ")}.` : "All three pieces of evidence are still inside."}`);
}

// ---- Controls -------------------------------------------------------------------------------

function seg(group, label, options) {
  return `<div class="seg" role="group" aria-label="${esc(label)}"><span class="seglabel">${esc(label)}</span>${options.map(([v, l]) => `<button type="button" class="pill" data-${group}="${v}" aria-pressed="false">${esc(l)}</button>`).join("")}</div>`;
}

function build() {
  if (guided) return buildGuided();
  app.innerHTML = `
    <details class="panel predict" open>
      <summary class="q"><strong>Predict first.</strong> Compacting the history saves 14,000 tokens, the biggest single cut. If you compact it and change nothing else, which evalset case breaks?</summary>
      <div class="chips" role="group" aria-label="Your prediction">
        ${Object.entries(PREDICT).map(([k, v]) => `<button type="button" class="chip${k === "none" ? "" : " mono"}" data-predict="${k}" aria-pressed="false">${esc(v)}</button>`).join("")}
      </div>
      <p class="verdict" id="verdict"></p>
    </details>
    <div class="panel stage">
      <div class="view">
        <div class="scroll" tabindex="0" role="region" aria-label="The backpack and the retrieved chunks"><svg id="svg" viewBox="0 0 760 430" role="img"></svg></div>
        <p class="caption" id="caption" role="status"></p>
        <section class="receipt" aria-labelledby="rc-h">
          <h2 id="rc-h">Receipt for one late turn</h2>
          <div class="rc"><span>Reads</span><span class="mono" id="r-total"></span></div>
          <div class="rc"><span>billed like</span><span class="mono" id="r-billed"></span></div>
          <div class="buttons"><button type="button" class="pill" id="cache" aria-pressed="false">Cache the prefix</button><button type="button" class="pill" id="reset">Reset</button></div>
        </section>
      </div>
      <div class="side">
        <div class="controls">
          ${seg("tools", "Tools", Object.entries(TOOLS).map(([k, v]) => [k, v.label]))}
          <div class="seg" role="group" aria-label="History"><span class="seglabel">History</span>
            <button type="button" class="pill" id="compact" aria-pressed="false">Compact it</button>
            <button type="button" class="pill" id="pin" aria-pressed="false">Pin order id in state</button>
          </div>
          ${seg("memory", "Memory", Object.entries(MEMORY).map(([k, v]) => [k, v.label]))}
          <div class="seg" role="group" aria-label="Retrieved chunks"><span class="seglabel">Chunks</span>
            <button type="button" class="pill" data-topk="10" aria-pressed="false">Top 10</button>
            <button type="button" class="pill" data-topk="5" aria-pressed="false">Top 5</button>
            <button type="button" class="pill" id="rerank" aria-pressed="false">Rerank first</button>
          </div>
        </div>
        <section class="evals" aria-labelledby="evals-h">
          <h2 id="evals-h">The evalset: is each case's evidence still in the bag?</h2>
          <ul id="cases"></ul>
        </section>
      </div>
    </div>
    <p class="legend">Token counts are the lesson's illustrative figures; chunk ranks are invented for the exercise. Hatching marks the cached prefix: still in the context window, billed at a tenth of the input rate.</p>`;
  els = {};
  for (const id of ["svg", "verdict", "caption", "cases", "compact", "pin", "rerank", "cache", "reset", "r-total", "r-billed"]) els[id] = app.querySelector(`#${id}`);
  buildScene();
  app.querySelectorAll("[data-predict]").forEach((b) => b.addEventListener("click", () => { prediction = b.dataset.predict; sim.event("predicted", { prediction }); render(); }));
  app.querySelectorAll("[data-tools]").forEach((b) => b.addEventListener("click", () => change("tools", b.dataset.tools)));
  app.querySelectorAll("[data-memory]").forEach((b) => b.addEventListener("click", () => change("memory", b.dataset.memory)));
  app.querySelectorAll("[data-topk]").forEach((b) => b.addEventListener("click", () => change("topk", Number(b.dataset.topk))));
  els.compact.addEventListener("click", () => change("compact", !pick.compact));
  els.pin.addEventListener("click", () => change("pin", !pick.pin));
  els.rerank.addEventListener("click", () => change("rerank", !pick.rerank));
  els.cache.addEventListener("click", () => { pick.cache = !pick.cache; sim.event("cache-toggled", { cache: pick.cache }); render(); });
  els.reset.addEventListener("click", () => { pick = { ...START }; render(); });
}

function change(key, value) {
  pick[key] = value;
  if (pick.compact && !pick.pin) sawCompactLoss = true;
  sim.event("cut-changed", { component: key, choice: value });
  render();
}

function captionText(total, cases) {
  const g = gems();
  if (g.order === "lost") return "Compaction summarised the old turns, and the summary dropped order id C9012: the gem fell out. Pin the id in session state so it survives the summary.";
  if (g.warranty === "lost") return "This tool_filter left out check_warranty, so the warranty question has no tool to call. Same 8,000 tokens saved by the right filter.";
  if (g.policy === "lost") return "Top 5 by similarity cut the return-policy chunk (rank 7). Rerank first and it moves to rank 2, inside the top 5.";
  const passed = cases.filter((c) => c.pass).length;
  if (passed === 3 && total <= GOAL) return pick.cache
    ? "Lean and passing. Caching made the stable prefix cheaper, but the model still reads every one of these tokens."
    : "Lean and passing: every case's evidence survived the cuts. Now turn on caching in the receipt and watch what changes, and what doesn't.";
  if (total === BEFORE) return "The bag is full: 47,000 tokens before the user's message. Cut it to the goal line without losing a gem.";
  return `${fmt(total)} tokens so far, all three gems still inside. Keep cutting toward the goal line.`;
}

function verdictText() {
  if (!prediction || !sawCompactLoss) return "";
  return prediction === "long_session_recall"
    ? "Right: long_session_recall breaks, because the summary drops order id C9012. Pinning it in state fixes that cause, but not the chunk the reranker has to rescue."
    : "Not quite: long_session_recall breaks, because the summary drops order id C9012 that turn 3 needs.";
}

function render() {
  if (guided) return renderGuided();
  const pressed = (sel, on) => app.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(on(b))));
  pressed("[data-predict]", (b) => b.dataset.predict === prediction);
  pressed("[data-tools]", (b) => b.dataset.tools === pick.tools);
  pressed("[data-memory]", (b) => b.dataset.memory === pick.memory);
  pressed("[data-topk]", (b) => Number(b.dataset.topk) === pick.topk);
  els.compact.setAttribute("aria-pressed", String(pick.compact));
  els.pin.setAttribute("aria-pressed", String(pick.pin));
  els.rerank.setAttribute("aria-pressed", String(pick.rerank));
  els.cache.setAttribute("aria-pressed", String(pick.cache));

  drawScene();
  const t = tokens();
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  const prefix = t.instructions + t.tools;
  const billed = pick.cache ? total - prefix + prefix * CACHED_RATE : total;
  const cases = evalCases();
  const passed = cases.filter((c) => c.pass).length;
  els.cases.innerHTML = cases.map((c) => `<li class="case ${c.pass ? "pass" : "fail"}"><span class="mono id">${c.id}</span><span class="verdict-tag">${c.pass ? "✓ Pass" : "✗ Fail"}</span><span class="why">${esc(c.why)}</span></li>`).join("");
  els["r-total"].textContent = `${fmt(total)} of ${fmt(BEFORE)} tokens`;
  els["r-billed"].textContent = pick.cache ? `${fmt(billed)} uncached tokens` : `${fmt(total)}, nothing cached`;
  els.caption.textContent = captionText(total, cases);
  els.verdict.textContent = verdictText();

  if (!reported && passed === 3 && total <= GOAL) {
    reported = true;
    sim.checkpoint("observe-evidence-survives");
    sim.event("lean-and-passing", { total, pick });
  }
  reportSize();
}

// ---- Guided mode: the figure's cuts, one step at a time --------------------------------------------

const LEDGER = { x: 372, y: 46, w: 368, row: 64 };

function guidedPick(n) {
  const p = { ...START };
  for (let i = 0; i <= n; i++) Object.assign(p, GSTEPS[i].pick);
  return p;
}

function guidedTotal(n) {
  const saved = pick;
  pick = guidedPick(n);
  const total = Object.values(tokens()).reduce((a, b) => a + b, 0);
  pick = saved;
  return total;
}

function buildGuidedScene() {
  els.svg.innerHTML = `
    <defs>
      <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" class="hatchline"/></pattern>
    </defs>
    <text class="h" x="${BAG.x + BAG.w / 2}" y="26">One late turn's context</text>
    <path class="strap" d="M${BAG.x + 50} ${BAG.y} Q${BAG.x + BAG.w / 2} ${BAG.y - 46} ${BAG.x + BAG.w - 50} ${BAG.y}"/>
    <rect class="bag" x="${BAG.x - 8}" y="${BAG.y - 8}" width="${BAG.w + 16}" height="${BAG.h + 16}" rx="22"/>
    <g id="blocks">${COMPONENTS.map((c) => `<g class="blk ${c.cls}" id="b-${c.id}"><rect x="${BAG.x}" width="${BAG.w}" rx="4"/><rect class="hatch" x="${BAG.x}" width="${BAG.w}" rx="4" fill="url(#hatch)"/><text class="bl" x="${BAG.x + 10}"></text><text class="bt" x="${BAG.x + 10}"></text></g>`).join("")}</g>
    <text class="h" x="${LEDGER.x + LEDGER.w / 2}" y="26">Tokens per turn, after each cut</text>
    <g id="ledger">${GSTEPS.map((s, i) => {
      const y = LEDGER.y + i * LEDGER.row;
      return `<g class="gl-row" id="gl-${i}">
        <rect x="${LEDGER.x}" y="${y}" width="${LEDGER.w}" height="${LEDGER.row - 10}" rx="8"/>
        <text class="gl-l" x="${LEDGER.x + 12}" y="${y + 22}">${i ? `${i}. ` : ""}${esc(s.row)}</text>
        <text class="gl-d" x="${LEDGER.x + 12}" y="${y + 41}">${esc(s.delta || "instructions, tools, history, memory, chunks")}</text>
        <text class="gl-t" x="${LEDGER.x + LEDGER.w - 12}" y="${y + 33}">${fmt(guidedTotal(i))}</text>
      </g>`;
    }).join("")}</g>
    <text class="gl-note" x="${LEDGER.x}" y="${LEDGER.y + GSTEPS.length * LEDGER.row + 8}">* Assumes compaction soon summarises each recalled result in history.</text>`;
  els.blocks = {};
  for (const c of COMPONENTS) els.blocks[c.id] = els.svg.querySelector(`#b-${c.id}`);
  els.rows = GSTEPS.map((_, i) => els.svg.querySelector(`#gl-${i}`));
}

function drawGuidedScene(t) {
  els.rows.forEach((r, i) => r.setAttribute("class", `gl-row ${i < gstep ? "done" : i === gstep ? "now" : "todo"}`));
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  els.svg.setAttribute("aria-label", `Stacked token blocks for one late turn of the support agent, after each cut. Step ${gstep + 1} of ${GSTEPS.length}, ${GSTEPS[gstep].row}: ${fmt(total)} of the original ${fmt(BEFORE)} tokens${pick.cache ? ", with the 5,000-token prefix of instructions and tool declarations cached; it still counts in the context window" : ""}.`);
}

function buildGuided() {
  app.innerHTML = `
    <details class="panel predict" open>
      <summary class="q">${esc(GPREDICT.question)}</summary>
      <div class="chips" role="group" aria-label="Your prediction">
        ${GPREDICT.options.map(([k, l]) => `<button type="button" class="chip" data-gpredict="${k}" aria-pressed="false">${esc(l)}</button>`).join("")}
      </div>
      <p class="verdict" id="verdict"></p>
    </details>
    <div class="panel stage">
      <div class="view">
        <div class="scroll" tabindex="0" role="region" aria-label="The backpack and the cuts"><svg id="svg" viewBox="0 0 760 430" role="img"></svg></div>
      </div>
      <div class="side">
        <p class="caption" id="caption" role="status"><span class="cap-h" id="cap-h"></span><span id="cap-t"></span></p>
        <nav class="gsteps" aria-label="Cuts">${GSTEPS.map((s, i) => `<button type="button" class="pill" data-gstep="${i}">${esc(s.label)}</button>`).join("")}</nav>
        <div class="buttons"><button type="button" id="back">Back</button><button type="button" class="primary" id="step">Step</button><button type="button" id="reset">Reset</button></div>
        <section class="receipt" aria-labelledby="rc-h">
          <h2 id="rc-h">Receipt for one late turn</h2>
          <div class="rc"><span>Reads</span><span class="mono" id="r-total"></span></div>
          <div class="rc"><span>billed like</span><span class="mono" id="r-billed"></span></div>
        </section>
      </div>
    </div>
    <p class="legend">Illustrative token counts from the lesson. Each step keeps the cuts before it. Retrieved chunks are a separate cut: rerank and pass a smaller top-k. Hatching marks the cached prefix.</p>`;
  els = {};
  for (const id of ["svg", "verdict", "caption", "cap-h", "cap-t", "back", "step", "reset", "r-total", "r-billed"]) els[id] = app.querySelector(`#${id}`);
  buildScene();
  app.querySelectorAll("[data-gpredict]").forEach((b) => b.addEventListener("click", () => { gpick = b.dataset.gpredict; sim.event("predicted", { prediction: gpick }); render(); }));
  app.querySelectorAll("[data-gstep]").forEach((b) => b.addEventListener("click", () => goGuided(Number(b.dataset.gstep))));
  els.back.addEventListener("click", () => goGuided(gstep - 1));
  els.step.addEventListener("click", () => goGuided(gstep + 1));
  els.reset.addEventListener("click", () => { gpick = null; goGuided(0); });
}

function goGuided(n) {
  gstep = Math.max(0, Math.min(GSTEPS.length - 1, n));
  sim.event("guided-step", { step: gstep });
  render();
}

function renderGuided() {
  pick = guidedPick(gstep);
  drawScene();
  app.querySelectorAll("[data-gpredict]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.gpredict === gpick)));
  app.querySelectorAll("[data-gstep]").forEach((b) => {
    if (Number(b.dataset.gstep) === gstep) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  });
  const t = tokens();
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  const prefix = t.instructions + t.tools;
  const billed = pick.cache ? total - prefix + prefix * CACHED_RATE : total;
  els["r-total"].textContent = `${fmt(total)} of ${fmt(BEFORE)} tokens`;
  els["r-billed"].textContent = pick.cache ? `${fmt(billed)} uncached tokens` : `${fmt(total)}, nothing cached`;
  els["cap-h"].textContent = `Step ${gstep + 1} of ${GSTEPS.length} · ${GSTEPS[gstep].label}`;
  els["cap-t"].textContent = GSTEPS[gstep].text;
  const last = gstep === GSTEPS.length - 1;
  const chosen = GPREDICT.options.find(([k]) => k === gpick);
  els.verdict.textContent = !last ? "" : !chosen
    ? "Make your prediction above to check it."
    : `You picked: ${chosen[1]}. ${gpick === GPREDICT.answer ? "Right." : "Not so."} ${GPREDICT.why}`;
  if (last && chosen && !gfired) {
    gfired = true;
    sim.checkpoint("observe-cuts-then-cache");
  }
  reportSize();
}

const sim = createSim({
  onInit({ props, theme, reducedMotion }) {
    guided = !!props && props.mode === "guided";
    applyTheme(theme);
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
