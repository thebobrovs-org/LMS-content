// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// B06: Grounded but wrong — Context Precision vs. Context Recall.
// Corpus chunks in a pond flow through an optional metadata filter barrier and a top-k
// retrieval net into the model's catch basket. Scores are scripted and deterministic
// (illustrative, not measured from a live embedding model).

const app = document.getElementById("app");

const PONDS = {
  small: [
    { id: "faq24", label: "2024 FAQ (60d)", role: "stale", sym: "▲ ⚠", sim: 0.93, rr: 0.95 },
    { id: "ship", label: "Shipping FAQ", role: "noise", sym: "□ ·", sim: 0.88, rr: 0.30 },
    { id: "pol26", label: "2026 Policy (30d)", role: "rel", sym: "● ✓", sim: 0.86, rr: 0.93 },
    { id: "exch", label: "Exchanges", role: "noise", sym: "□ ·", sim: 0.81, rr: 0.55 },
    { id: "warr", label: "Warranty", role: "noise", sym: "□ ·", sim: 0.76, rr: 0.38 },
    { id: "exc26", label: "2026 Final-sale", role: "rel", sym: "● ✓", sim: 0.58, rr: 0.82 },
  ],
  medium: [
    { id: "faq24", label: "2024 FAQ (60d)", role: "stale", sym: "▲ ⚠", sim: 0.90, rr: 0.94 },
    { id: "ship", label: "Shipping FAQ", role: "noise", sym: "□ ·", sim: 0.85, rr: 0.31 },
    { id: "pol26", label: "2026 Policy (30d)", role: "rel", sym: "● ✓", sim: 0.83, rr: 0.92, full: true },
    { id: "exch", label: "Exchanges", role: "noise", sym: "□ ·", sim: 0.80, rr: 0.55 },
    { id: "warr", label: "Warranty", role: "noise", sym: "□ ·", sim: 0.78, rr: 0.40 },
    { id: "gift", label: "Gift cards", role: "noise", sym: "□ ·", sim: 0.62, rr: 0.10 },
  ],
  large: [
    { id: "faq24", label: "2024 FAQ (whole)", role: "stale", sym: "▲ ⚠", sim: 0.79, rr: 0.90 },
    { id: "pol26", label: "2026 Policy (whole)", role: "rel", sym: "● ✓", sim: 0.77, rr: 0.89, full: true },
    { id: "ship", label: "Shipping FAQ", role: "noise", sym: "□ ·", sim: 0.74, rr: 0.30 },
    { id: "warr", label: "Warranty", role: "noise", sym: "□ ·", sim: 0.70, rr: 0.35 },
    { id: "gift", label: "Gift cards", role: "noise", sym: "□ ·", sim: 0.58, rr: 0.08 },
  ],
};

let chunk = "medium";
let topK = 3;
let rerank = false;
let filter = false;
let prediction = null;
let hasRun = true;
let sawWrong = false;
let checkpointSent = false;

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function compute() {
  const key = rerank ? "rr" : "sim";
  const ranked = PONDS[chunk].map((c) => ({ ...c, score: c[key] })).sort((a, b) => b.score - a.score);
  const totalRel = ranked.filter((c) => c.role === "rel").length;
  const caught = [];
  for (const c of ranked) {
    c.blocked = filter && c.role === "stale";
    c.inCatch = !c.blocked && caught.length < topK;
    if (c.inCatch) caught.push(c);
  }
  const relCaught = caught.filter((c) => c.role === "rel").length;
  const recall = totalRel ? Math.round((relCaught / totalRel) * 100) : 0;
  const precision = caught.length ? Math.round((relCaught / caught.length) * 100) : 0;

  const firstPolicy = caught.find((c) => c.role === "stale" || c.role === "rel");
  const hasFull = caught.some((c) => c.full) || relCaught === totalRel;

  let ansKind = "none";
  let ansText = "“Not found in sources.”";
  let ansCite = "Recall 0%: no policy chunk caught.";
  if (firstPolicy && firstPolicy.role === "stale") {
    ansKind = "wrong";
    ansText = "“60 days.” (Grounded, WRONG)";
    ansCite = "Cites #1: 2024 FAQ (superseded).";
  } else if (firstPolicy && !hasFull) {
    ansKind = "partial";
    ansText = "“30 days.” (Incomplete)";
    ansCite = "Final-sale chunk missed (Recall 50%).";
  } else if (firstPolicy) {
    ansKind = "right";
    ansText = "“30 days, excl. final-sale.” (RIGHT)";
    ansCite = "Cites #1: 2026 Policy (current).";
  }
  return { ranked, caught, totalRel, relCaught, recall, precision, ansKind, ansText, ansCite };
}

function buildSvg(state) {
  const { ranked, caught, ansKind, ansText, ansCite } = state;
  const pondNodes = ranked
    .map((c, i) => {
      const y = 44 + i * 36;
      const cls = c.blocked ? "node-blocked" : c.role === "rel" ? "node-rel" : c.role === "stale" ? "node-stale" : "node-noise";
      const nowCls = c.inCatch ? " k-now" : "";
      const badge = c.blocked ? "BLOCKED" : c.score.toFixed(2);
      return `
        <g>
          <rect x="14" y="${y}" width="234" height="28" rx="6" class="${cls}${nowCls}" />
          <text x="24" y="${y + 18}" class="k-label">${esc(c.sym)} ${esc(c.label)}</text>
          <text x="240" y="${y + 18}" text-anchor="end" class="k-small">${esc(badge)}</text>
        </g>`;
    })
    .join("");

  const catchNodes = Array.from({ length: topK }, (_, i) => {
    const y = 44 + i * 36;
    const c = caught[i];
    if (!c) {
      return `<rect x="448" y="${y}" width="250" height="28" rx="6" class="k-off" />
        <text x="458" y="${y + 18}" class="k-small">#${i + 1} empty</text>`;
    }
    const cls = c.role === "rel" ? "node-rel" : c.role === "stale" ? "node-stale" : "node-noise";
    const strokeNow = i === 0 ? " k-now" : "";
    return `
      <g>
        <rect x="448" y="${y}" width="250" height="28" rx="6" class="${cls}${strokeNow}" />
        <text x="458" y="${y + 18}" class="k-label">#${i + 1} ${esc(c.sym)} ${esc(c.label)}</text>
      </g>`;
  }).join("");

  const ansClass = ansKind === "wrong" ? "ans-wrong" : ansKind === "partial" ? "ans-partial" : ansKind === "right" ? "ans-right" : "k-box";
  const ansY = 44 + Math.max(topK, 3) * 36 + 10;
  const totalH = Math.max(276, ansY + 58);

  const barrierClass = filter ? "barrier-on" : "barrier-off";
  const barrierLabel = filter ? "Filter ON: blocks ▲" : "No filter";
  const aria = `Corpus pond with ${ranked.length} chunks; metadata filter is ${filter ? "on" : "off"}; top-${topK} net caught ${caught.length} chunks with ${state.recall}% recall and ${state.precision}% precision; model answers ${ansText}`;

  return `<svg viewBox="0 0 716 ${totalH}" role="img" aria-label="${esc(aria)}">
    <rect x="6" y="8" width="250" height="${totalH - 16}" rx="10" class="pond-box" />
    <text x="16" y="28" class="k-title">1. Corpus Pond (${esc(chunk)})</text>
    ${pondNodes}

    <line x1="292" y1="26" x2="292" y2="${totalH - 22}" class="${barrierClass}" />
    <text x="292" y="17" text-anchor="middle" class="k-small">${esc(barrierLabel)}</text>

    <rect x="322" y="92" width="98" height="64" rx="10" class="net-box" />
    <text x="371" y="118" text-anchor="middle" class="k-title">Top-${topK} Net</text>
    <text x="371" y="136" text-anchor="middle" class="k-small">${rerank ? "Reranked" : "Similarity"} →</text>

    <rect x="438" y="8" width="270" height="${totalH - 16}" rx="10" class="basket-box" />
    <text x="448" y="28" class="k-title">2. Model Catch (reads #1 first)</text>
    ${catchNodes}

    <rect x="448" y="${ansY}" width="250" height="44" rx="8" class="${ansClass}" />
    <text x="458" y="${ansY + 18}" class="k-label">${esc(ansText)}</text>
    <text x="458" y="${ansY + 34}" class="k-small">${esc(ansCite)}</text>
  </svg>`;
}

function verdictText(state) {
  if (!prediction || !hasRun) return "";
  if (prediction === "wrong") {
    return "Your prediction matched at default settings: even with 100% recall, the superseded 2024 FAQ ranked #1 (33% precision) and grounded a 60-day answer.";
  }
  if (prediction === "right") {
    return "Not at default settings: the 2026 policy IS in the catch (100% recall), but the 2024 FAQ ranks #1 and wins.";
  }
  return "It found a policy — just the wrong one: the 2024 FAQ ranked #1 and grounded “60 days”.";
}

function captionText(state) {
  if (!hasRun) return "Press Retrieve to scoop Top-k chunks from the pond.";
  if (state.ansKind === "wrong") {
    return `Recall ${state.recall}% (${state.relCaught}/${state.totalRel} relevant), Precision ${state.precision}% (${state.relCaught}/${state.caught.length}) — ▲ 2024 FAQ is #1 and grounds “60 days”. Raising Top-k only adds noise; turn on the metadata filter.`;
  }
  if (state.ansKind === "partial") {
    return `Metadata filter blocked ▲ 2024 FAQ, but at Small chunks Recall is ${state.recall}% (${state.relCaught}/${state.totalRel}) — turn on Rerank or raise Top-k to catch the final-sale exception.`;
  }
  if (state.ansKind === "right") {
    return `Metadata filter blocked ▲ 2024 FAQ: Recall ${state.recall}%, Precision ${state.precision}%, and the 2026 policy leads the catch.`;
  }
  return `Recall is 0% — raise Top-k or turn on Rerank so the 2026 policy enters the catch.`;
}

function maybeCheckpoint(state) {
  if (state.ansKind === "wrong") sawWrong = true;
  if (!checkpointSent && sawWrong && filter && state.ansKind === "right") {
    checkpointSent = true;
    sim.checkpoint("observe-stale-grounding");
    sim.event("fixed-stale-grounding", { chunk, topK, rerank });
  }
}

function build() {
  app.innerHTML = `
    <section class="panel predict" aria-label="Predict step">
      <p class="q"><strong>Predict first:</strong> Query is “How many days do I have to return an item?” With Medium chunks, Top-k = 3, and no filter, what will the model answer?</p>
      <div class="chips" role="group" aria-label="Prediction choices">
        <button type="button" class="chip" data-pred="right" aria-pressed="false">30 days (right)</button>
        <button type="button" class="chip" data-pred="wrong" aria-pressed="false">60 days (grounded, wrong)</button>
        <button type="button" class="chip" data-pred="none" aria-pressed="false">Not found</button>
      </div>
      <p class="verdict" id="verdict"></p>
    </section>

    <section class="panel stage" aria-label="Retrieval pond simulation">
      <div class="scroll" id="scrollWrap" tabindex="0" role="region" aria-label="Corpus pond, filter barrier, and model catch basket"></div>
      <div class="why">
        <p class="why-title">Why it happens: similarity scores wording overlap, not freshness</p>
        <div class="why-grid">
          <div class="why-card stale"><strong>▲ 2024 FAQ (0.90 · #1):</strong> “<span class="hl">How many days do I have to return an item?</span> You have 60 days…”</div>
          <div class="why-card rel"><strong>● 2026 Policy (0.83 · #3):</strong> “Items can be <span class="hl">returned</span> within 30 <span class="hl">days</span> of delivery…”</div>
        </div>
      </div>
      <p class="caption" id="caption" role="status"></p>
      <div class="controls">
        <div class="seg" role="group" aria-label="Chunk size">
          <span class="seglabel">Chunks</span>
          <button type="button" class="chip" data-chunk="small" aria-pressed="false">Small</button>
          <button type="button" class="chip" data-chunk="medium" aria-pressed="true">Medium</button>
          <button type="button" class="chip" data-chunk="large" aria-pressed="false">Large</button>
        </div>
        <div class="seg" role="group" aria-label="Top-k">
          <span class="seglabel">Top-k</span>
          <button type="button" class="chip" data-k="1" aria-pressed="false">1</button>
          <button type="button" class="chip" data-k="3" aria-pressed="true">3</button>
          <button type="button" class="chip" data-k="5" aria-pressed="false">5</button>
        </div>
        <div class="chips" role="group" aria-label="Retrieval filters">
          <button type="button" class="chip" id="rerankBtn" aria-pressed="false">Rerank</button>
          <button type="button" class="chip" id="filterBtn" aria-pressed="false">Filter: current only</button>
        </div>
        <div class="buttons">
          <button type="button" class="primary" id="retrieveBtn">Retrieve</button>
          <button type="button" id="resetBtn">Reset</button>
        </div>
      </div>
    </section>

    <section class="ratios" aria-label="Context recall and precision">
      <div class="panel">
        <h2>Context Recall (caught ✓ / pond ✓)</h2>
        <div class="ratio-val" id="recVal"></div>
        <div class="tokens" id="recTokens"></div>
      </div>
      <div class="panel">
        <h2>Context Precision (caught ✓ / all caught)</h2>
        <div class="ratio-val" id="precVal"></div>
        <div class="tokens" id="precTokens"></div>
      </div>
    </section>

    <p class="legend">● ✓ Current 2026 policy (green) · ▲ ⚠ Superseded 2024 FAQ (red) · □ · Noise (dashed) · Amber line = metadata filter · Scores are scripted and illustrative.</p>
  `;

  app.querySelectorAll("[data-pred]").forEach((btn) => {
    btn.addEventListener("click", () => {
      prediction = btn.dataset.pred;
      hasRun = true;
      render();
    });
  });
  app.querySelectorAll("[data-chunk]").forEach((btn) => {
    btn.addEventListener("click", () => {
      chunk = btn.dataset.chunk;
      render();
    });
  });
  app.querySelectorAll("[data-k]").forEach((btn) => {
    btn.addEventListener("click", () => {
      topK = Number(btn.dataset.k);
      render();
    });
  });
  app.querySelector("#rerankBtn").addEventListener("click", () => {
    rerank = !rerank;
    render();
  });
  app.querySelector("#filterBtn").addEventListener("click", () => {
    filter = !filter;
    render();
  });
  app.querySelector("#retrieveBtn").addEventListener("click", () => {
    hasRun = true;
    render();
  });
  app.querySelector("#resetBtn").addEventListener("click", () => {
    chunk = "medium";
    topK = 3;
    rerank = false;
    filter = false;
    hasRun = true;
    render();
  });
}

function render() {
  if (!app.firstElementChild) build();
  const state = compute();
  maybeCheckpoint(state);

  app.querySelectorAll("[data-pred]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pred === prediction)));
  app.querySelectorAll("[data-chunk]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.chunk === chunk)));
  app.querySelectorAll("[data-k]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.k) === topK)));
  app.querySelector("#rerankBtn").setAttribute("aria-pressed", String(rerank));
  app.querySelector("#filterBtn").setAttribute("aria-pressed", String(filter));

  app.querySelector("#verdict").textContent = verdictText(state);
  app.querySelector("#scrollWrap").innerHTML = buildSvg(state);
  app.querySelector("#caption").textContent = captionText(state);

  app.querySelector("#recVal").textContent = `${state.relCaught}/${state.totalRel} (${state.recall}%)`;
  app.querySelector("#recTokens").innerHTML = Array.from({ length: state.totalRel }, (_, i) =>
    i < state.relCaught ? `<span class="tok rel">● ✓ caught</span>` : `<span class="tok missed">○ missed</span>`
  ).join("");

  app.querySelector("#precVal").textContent = `${state.relCaught}/${state.caught.length} (${state.precision}%)`;
  app.querySelector("#precTokens").innerHTML = state.caught
    .map((c) => `<span class="tok ${c.role}">${esc(c.sym)} ${esc(c.role === "rel" ? "2026" : c.role === "stale" ? "2024" : "noise")}</span>`)
    .join("");

  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

const sim = createSim({
  onInit({ props, theme, reducedMotion }) {
    applyTheme(theme);
    document.documentElement.classList.toggle("reduced", Boolean(reducedMotion));
    if (props && typeof props.chunk === "string" && PONDS[props.chunk]) chunk = props.chunk;
    if (props && typeof props.topK === "number" && [1, 3, 5].includes(props.topK)) topK = props.topK;
    render();
  },
});

setTimeout(() => {
  if (!sim.isInitialized()) render();
}, 300);
