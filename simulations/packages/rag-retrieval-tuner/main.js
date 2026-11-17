// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// One question, a small corpus with a superseded and a current version of the same
// policy, and the retrieval knobs that decide which chunks reach the model: chunk
// size, top-k, reranking and a metadata filter. Scores are scripted and deterministic,
// chosen to show the documented behaviour, not measured from a real embedding model.

const app = document.getElementById("app");

const QUESTION = "How many days do I have to return an item?";

// role: stale (superseded policy), current (current policy), exception (current, final-sale rule), other.
const CHUNKS = {
  small: [
    { doc: "Refund FAQ · 2024 · superseded", role: "stale", text: "How many days do I have to return an item? You have 60 days.", tokens: 90, sim: 0.93, rr: 0.95 },
    { doc: "Shipping FAQ · 2026", role: "other", text: "How many days does delivery take? Standard delivery takes 3 to 5 days.", tokens: 60, sim: 0.88, rr: 0.3 },
    { doc: "Returns policy · 2026 · current", role: "current", text: "Items can be returned within 30 days of delivery for a full refund.", tokens: 70, sim: 0.86, rr: 0.93 },
    { doc: "Exchanges · 2026", role: "other", text: "You can exchange an item for another size within 30 days.", tokens: 60, sim: 0.81, rr: 0.55 },
    { doc: "Warranty · 2026", role: "other", text: "Items carry a one-year warranty from delivery.", tokens: 50, sim: 0.76, rr: 0.38 },
    { doc: "Shipping FAQ · 2026", role: "other", text: "Express delivery takes 1 to 2 days.", tokens: 40, sim: 0.7, rr: 0.2 },
    { doc: "Gift cards · 2025", role: "other", text: "Gift cards never expire and cannot be refunded.", tokens: 50, sim: 0.6, rr: 0.08 },
    { doc: "Returns policy · 2026 · current", role: "exception", text: "Final-sale items cannot be returned.", tokens: 40, sim: 0.58, rr: 0.62 },
  ],
  medium: [
    { doc: "Refund FAQ · 2024 · superseded", role: "stale", text: "How many days do I have to return an item? You have 60 days from delivery to return any item, no questions asked.", tokens: 280, sim: 0.9, rr: 0.94 },
    { doc: "Shipping FAQ · 2026", role: "other", text: "How many days does delivery take? Standard delivery takes 3 to 5 days; express takes 1 to 2.", tokens: 260, sim: 0.85, rr: 0.31 },
    { doc: "Returns policy · 2026 · current", role: "current", text: "Items can be returned within 30 days of delivery for a full refund. Final-sale items cannot be returned.", tokens: 300, sim: 0.83, rr: 0.92, exception: true },
    { doc: "Exchanges · 2026", role: "other", text: "You can exchange an item for another size or colour within 30 days, once per order.", tokens: 240, sim: 0.8, rr: 0.55 },
    { doc: "Warranty · 2026", role: "other", text: "Items carry a one-year warranty from the day of delivery against manufacturing faults.", tokens: 250, sim: 0.78, rr: 0.4 },
    { doc: "Gift cards · 2025", role: "other", text: "Gift cards never expire and cannot be exchanged for cash or refunded.", tokens: 220, sim: 0.62, rr: 0.1 },
  ],
  large: [
    { doc: "Refund FAQ · 2024 · superseded", role: "stale", text: "The whole 2024 refund FAQ: return window (60 days), refund methods, store credit, damaged items…", tokens: 800, sim: 0.79, rr: 0.9 },
    { doc: "Returns policy · 2026 · current", role: "current", text: "The whole 2026 returns policy: 30-day window, final-sale exclusions, refund timing, return labels…", tokens: 760, sim: 0.77, rr: 0.89, exception: true },
    { doc: "Shipping FAQ · 2026", role: "other", text: "The whole shipping FAQ: delivery times, carriers, tracking, international orders…", tokens: 820, sim: 0.74, rr: 0.3 },
    { doc: "Warranty · 2026", role: "other", text: "The whole warranty page: one-year coverage, claims, exclusions…", tokens: 600, sim: 0.7, rr: 0.35 },
    { doc: "Gift cards · 2025", role: "other", text: "The whole gift card page: balances, expiry, refunds…", tokens: 500, sim: 0.58, rr: 0.08 },
  ],
};

let chunk = "medium";
let topK = 3;
let rerank = false;
let filter = false;
let sawWrong = false;
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

// The pipeline: rank by vector similarity, optionally rerank the candidates, drop
// filtered chunks, keep the top k. Returns every chunk with its fate, in display order.
function retrieve() {
  const all = CHUNKS[chunk].map((c, i) => ({ ...c, i }));
  const key = rerank ? "rr" : "sim";
  const ranked = all.slice().sort((a, b) => b[key] - a[key]);
  let kept = 0;
  for (const c of ranked) {
    c.filtered = filter && c.role === "stale";
    c.inContext = !c.filtered && kept < topK;
    if (c.inContext) kept += 1;
  }
  return ranked;
}

function answer(ranked) {
  const ctx = ranked.filter((c) => c.inContext);
  const tokens = ctx.reduce((n, c) => n + c.tokens, 0);
  const firstPolicy = ctx.find((c) => c.role === "stale" || c.role === "current");
  const hasException = ctx.some((c) => c.role === "exception" || (c.role === "current" && c.exception));
  if (!firstPolicy) {
    return { kind: "none", tokens, text: "“I can't find the return window in the sources I was given.”", note: "No policy chunk reached the model: retrieval failed, so the answer is honest but useless." };
  }
  const conflict = ctx.some((c) => c.role === "stale") && ctx.some((c) => c.role === "current");
  if (firstPolicy.role === "stale") {
    return {
      kind: "wrong",
      tokens,
      text: "“You have 60 days to return an item.” Cites: Refund FAQ (2024).",
      note: conflict
        ? "Both versions reached the model and it followed the higher-ranked, superseded one."
        : "The answer faithfully cites a superseded document.",
    };
  }
  return {
    kind: hasException ? "right" : "partial",
    tokens,
    text: hasException ? "“You have 30 days from delivery, except for final-sale items.” Cites: Returns policy (2026)." : "“You have 30 days from delivery.” Cites: Returns policy (2026).",
    note: hasException ? "Only the current policy reached the model." : "The final-sale exception sits in a chunk that did not make the top k.",
  };
}

function build() {
  app.innerHTML = `
    <p class="question">Question: “${esc(QUESTION)}”</p>
    <div class="controls">
      <label class="field">Chunk size
        <select id="chunk">
          <option value="small">Small (about 60 tokens)</option>
          <option value="medium">Medium (about 260 tokens)</option>
          <option value="large">Large (whole documents)</option>
        </select>
      </label>
      <label class="field" for="topk"><span class="nowrap">Top-k: <span id="kval"></span></span>
        <input id="topk" type="range" min="1" max="6" step="1" />
      </label>
      <label class="check"><input id="rerank" type="checkbox" /> Rerank candidates</label>
      <label class="check"><input id="filter" type="checkbox" /> Metadata filter: current documents only</label>
      <button id="reset">Reset</button>
    </div>
    <p class="readout" id="readout" role="status"></p>
    <section class="ranked" aria-labelledby="ranked-h">
      <h2 id="ranked-h">Ranked chunks</h2>
      <ol id="list"></ol>
    </section>
    <p class="legend">A blue border marks a chunk in the model's context. Scores are illustrative: vector similarity without reranking, reranker relevance with it.</p>`;
  els = {
    chunk: app.querySelector("#chunk"),
    topk: app.querySelector("#topk"),
    kval: app.querySelector("#kval"),
    rerank: app.querySelector("#rerank"),
    filter: app.querySelector("#filter"),
    reset: app.querySelector("#reset"),
    readout: app.querySelector("#readout"),
    list: app.querySelector("#list"),
  };
  els.chunk.addEventListener("change", () => { chunk = els.chunk.value; render(); });
  els.topk.addEventListener("input", () => { topK = Number(els.topk.value); render(); });
  els.rerank.addEventListener("change", () => { rerank = els.rerank.checked; render(); });
  els.filter.addEventListener("change", () => { filter = els.filter.checked; render(); });
  els.reset.addEventListener("click", () => { chunk = "medium"; topK = 3; rerank = false; filter = false; syncControls(); render(); });
  syncControls();
}

function syncControls() {
  els.chunk.value = chunk;
  els.topk.value = String(topK);
  els.rerank.checked = rerank;
  els.filter.checked = filter;
}

function render() {
  const ranked = retrieve();
  const a = answer(ranked);
  const key = rerank ? "rr" : "sim";
  els.kval.textContent = String(topK);
  els.list.innerHTML = ranked
    .map((c, n) => {
      const cls = c.role === "stale" ? "stale" : c.role === "current" || c.role === "exception" ? "current" : "other";
      const tag = c.filtered ? `<span class="tag filtered">filtered out</span>` : c.inContext ? `<span class="tag inctx">in context</span>` : "";
      const pct = Math.round(c[key] * 100);
      return `<li class="chunk ${c.inContext ? "in" : "out"}">
        <span class="rank">${n + 1}</span>
        <span><span class="doc ${cls}">${esc(c.doc)}</span>${tag}<span class="text">${esc(c.text)}</span></span>
        <span class="score">${(c[key]).toFixed(2)} · ${c.tokens} tok<span class="bar" aria-hidden="true"><span style="width:${pct}%"></span></span></span>
      </li>`;
    })
    .join("");
  const label = { wrong: "Grounded but wrong", right: "Correct", partial: "Correct but incomplete", none: "No answer" }[a.kind];
  els.readout.className = `readout ${a.kind === "wrong" ? "wrong" : a.kind === "right" ? "right" : ""}`;
  els.readout.innerHTML = `${label}: ${esc(a.text)}<span class="sub">${esc(a.note)} Context: ${ranked.filter((c) => c.inContext).length} chunks, ${a.tokens.toLocaleString("en-US")} tokens.</span>`;
  if (a.kind === "wrong") sawWrong = true;
  if (filter && sawWrong && (a.kind === "right" || a.kind === "partial") && !reported) {
    reported = true;
    sim.checkpoint("observe-stale-grounding");
  }
  sim.event("retrieve", { chunk, topK, rerank, filter, result: a.kind });
  reportSize();
}

function readProps(props) {
  if (props && CHUNKS[props.chunk]) chunk = props.chunk;
  const k = Number(props && props.topK);
  if (Number.isFinite(k) && k >= 1 && k <= 6) topK = Math.floor(k);
}

const sim = createSim({
  onInit({ props, theme }) {
    applyTheme(theme);
    readProps(props);
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
