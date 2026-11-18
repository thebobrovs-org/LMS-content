// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// The right catch. The corpus is a pond and every chunk is a fish, lined up by how
// similar it is to the question: rank 1 swims nearest the net. The net is top-k. Green
// fish are the ones a correct answer needs (the current returns policy and its final-sale
// rule); the red one is the 2024 refund FAQ, superseded but still in the corpus, and it
// restates the question word for word, so it ranks first. The bucket is what the model
// reads; it answers from the first policy fish it finds. Two meters score the catch:
// precision (wanted fish in the net / fish in the net) and recall (wanted fish in the net
// / all wanted fish). The aha: recall can be perfect while the superseded fish grounds a
// faithful, cited, wrong answer, and only throwing it back before search (a metadata
// filter) fixes that; a bigger net or a reranker does not. Scores are scripted and
// deterministic, chosen to show the documented behaviour, not measured from a real
// embedding model.

const app = document.getElementById("app");

const QUESTION = "How many days do I have to return an item?";

// role: stale (superseded policy), current (current policy), exception (current, final-sale rule), other.
// `exception: true` marks a current chunk that also carries the final-sale rule.
const CHUNKS = {
  small: [
    { name: "2024 refund FAQ · 60 days", doc: "Refund FAQ · 2024 · superseded", role: "stale", text: "How many days do I have to return an item? You have 60 days.", sim: 0.93, rr: 0.95 },
    { name: "Shipping · 3–5 days", doc: "Shipping FAQ · 2026", role: "other", text: "How many days does delivery take? Standard delivery takes 3 to 5 days.", sim: 0.88, rr: 0.3 },
    { name: "2026 returns · 30 days", doc: "Returns policy · 2026 · current", role: "current", text: "Items can be returned within 30 days of delivery for a full refund.", sim: 0.86, rr: 0.93 },
    { name: "Exchanges · 30 days", doc: "Exchanges · 2026", role: "other", text: "You can exchange an item for another size within 30 days.", sim: 0.81, rr: 0.55 },
    { name: "Warranty · 1 year", doc: "Warranty · 2026", role: "other", text: "Items carry a one-year warranty from delivery.", sim: 0.76, rr: 0.38 },
    { name: "Express · 1–2 days", doc: "Shipping FAQ · 2026", role: "other", text: "Express delivery takes 1 to 2 days.", sim: 0.7, rr: 0.2 },
    { name: "Gift cards", doc: "Gift cards · 2025", role: "other", text: "Gift cards never expire and cannot be refunded.", sim: 0.6, rr: 0.08 },
    { name: "2026 returns · final sale", doc: "Returns policy · 2026 · current", role: "exception", text: "Final-sale items cannot be returned.", sim: 0.58, rr: 0.62 },
  ],
  medium: [
    { name: "2024 refund FAQ · 60 days", doc: "Refund FAQ · 2024 · superseded", role: "stale", text: "How many days do I have to return an item? You have 60 days from delivery to return any item, no questions asked.", sim: 0.9, rr: 0.94 },
    { name: "Shipping · delivery days", doc: "Shipping FAQ · 2026", role: "other", text: "How many days does delivery take? Standard delivery takes 3 to 5 days; express takes 1 to 2.", sim: 0.85, rr: 0.31 },
    { name: "2026 returns · 30 days + final sale", doc: "Returns policy · 2026 · current", role: "current", text: "Items can be returned within 30 days of delivery for a full refund. Final-sale items cannot be returned.", sim: 0.83, rr: 0.92, exception: true },
    { name: "Exchanges · 30 days", doc: "Exchanges · 2026", role: "other", text: "You can exchange an item for another size or colour within 30 days, once per order.", sim: 0.8, rr: 0.55 },
    { name: "Warranty · 1 year", doc: "Warranty · 2026", role: "other", text: "Items carry a one-year warranty from the day of delivery against manufacturing faults.", sim: 0.78, rr: 0.4 },
    { name: "Gift cards", doc: "Gift cards · 2025", role: "other", text: "Gift cards never expire and cannot be exchanged for cash or refunded.", sim: 0.62, rr: 0.1 },
  ],
  large: [
    { name: "Whole 2024 refund FAQ", doc: "Refund FAQ · 2024 · superseded", role: "stale", text: "The whole 2024 refund FAQ: return window (60 days), refund methods, store credit, damaged items…", sim: 0.79, rr: 0.9 },
    { name: "Whole 2026 returns policy", doc: "Returns policy · 2026 · current", role: "current", text: "The whole 2026 returns policy: 30-day window, final-sale exclusions, refund timing, return labels…", sim: 0.77, rr: 0.89, exception: true },
    { name: "Whole shipping FAQ", doc: "Shipping FAQ · 2026", role: "other", text: "The whole shipping FAQ: delivery times, carriers, tracking, international orders…", sim: 0.74, rr: 0.3 },
    { name: "Whole warranty page", doc: "Warranty · 2026", role: "other", text: "The whole warranty page: one-year coverage, claims, exclusions…", sim: 0.7, rr: 0.35 },
    { name: "Whole gift card page", doc: "Gift cards · 2025", role: "other", text: "The whole gift card page: balances, expiry, refunds…", sim: 0.58, rr: 0.08 },
  ],
};
const SIZES = { small: "Small", medium: "Medium", large: "Whole docs" };
const PREDICT = { right: "“30 days”", wrong: "“60 days”", none: "“I can't find it”" };

// Drawing (viewBox 760 x 440). The pond on the left, the dock on the right.
const POND = { x: 12, y: 40, w: 444, h: 388 };
const ROW = { y: 66, h: 36 };
const FISH = { x: 64, w: 250, h: 26 };
const MESH = { x: 28, y: 366, w: 412, h: 52 };
const DOCK = { x: 476, w: 272 };

const START = { chunk: "medium", topK: 3, rerank: false, filter: false };
let pick = { ...START };
let prediction = null;
let cast = false; // the first cast has happened; after it every change re-casts
let firstResult = null;
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

const wanted = (c) => c.role === "current" || c.role === "exception";

// The pipeline: the metadata filter drops superseded chunks before search, then rank by
// vector similarity (or reranker relevance), then keep the top k. Every chunk comes back
// with its fate: lane rank, in the net, or filtered.
function retrieve() {
  const all = CHUNKS[pick.chunk].map((c, i) => ({ ...c, i }));
  const key = pick.rerank ? "rr" : "sim";
  const eligible = all.filter((c) => !(pick.filter && c.role === "stale")).sort((a, b) => b[key] - a[key]);
  eligible.forEach((c, n) => { c.rank = n; c.caught = n < pick.topK; });
  for (const c of all) if (c.rank === undefined) c.filtered = true;
  const net = eligible.filter((c) => c.caught);
  const want = all.filter(wanted);
  const hit = net.filter(wanted);
  return { all, eligible, net, key, want, hit };
}

function answer(net) {
  const first = net.find((c) => c.role === "stale" || c.role === "current");
  const hasException = net.some((c) => c.role === "exception" || (c.role === "current" && c.exception));
  if (!first) return { kind: "none", lines: ["“I can't find the return window", "in the sources I was given.”"], first: null };
  if (first.role === "stale") return { kind: "wrong", lines: ["“You have 60 days to return", "an item.” Cites: Refund FAQ 2024"], first };
  return hasException
    ? { kind: "right", lines: ["“30 days from delivery, except", "final-sale items.” Cites: Returns 2026"], first }
    : { kind: "partial", lines: ["“You have 30 days from delivery.”", "Cites: Returns 2026"], first };
}

// ---- Drawing --------------------------------------------------------------------------------

function fishPath(w, h) {
  // A flat fish facing right (toward the dock): a rounded body from 12 to w, a tail from 0 to 12.
  const m = h / 2;
  const r = Math.min(h * 0.9, 22);
  return `M12 ${m} Q12 0 ${12 + r} 0 L${w - r - 6} 0 Q${w} 0 ${w} ${m} Q${w} ${h} ${w - r - 6} ${h} L${12 + r} ${h} Q12 ${h} 12 ${m} Z M12 ${m} L0 1 L0 ${h - 1} Z`;
}

function miniFish(x, y, cls) {
  return `<g class="mini ${cls}" transform="translate(${x},${y})"><path d="${fishPath(26, 12)}"/></g>`;
}

function roleClass(c) {
  return c.role === "stale" ? "stale" : wanted(c) ? "want" : "noise";
}

function buildScene() {
  els.svg.innerHTML = `
    <defs>
      <pattern id="mesh" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 0 L8 8 M8 0 L0 8" class="meshline"/></pattern>
    </defs>
    <rect class="pond" x="${POND.x}" y="${POND.y}" width="${POND.w}" height="${POND.h}" rx="18"/>
    <text class="h" x="${POND.x + 14}" y="26">The pond: every chunk, ranked by similarity</text>
    <text class="k-small" id="keylabel" x="${FISH.x + FISH.w + 14}" y="${ROW.y - 12}"></text>
    <g class="meshzone" id="meshzone"><rect x="${MESH.x}" y="${MESH.y}" width="${MESH.w}" height="${MESH.h}" rx="10"/><rect class="meshfill" x="${MESH.x}" y="${MESH.y}" width="${MESH.w}" height="${MESH.h}" rx="10" fill="url(#mesh)"/><text class="meshlabel" id="meshlabel" x="${MESH.x}" y="${MESH.y - 8}"></text></g>
    <g id="fish"></g>
    <g class="net" id="net"><rect id="netrect" x="${FISH.x - 30}" width="${FISH.w + 108}" rx="14"/><text class="netlabel" id="netlabel"></text></g>`;
  els.dock.innerHTML = `
    <text class="h" x="${DOCK.x}" y="26">The dock</text>
    <rect class="bucket" x="${DOCK.x}" y="44" width="${DOCK.w}" height="166" rx="12"/>
    <text class="k-label" x="${DOCK.x + 12}" y="62">The bucket: what the model reads</text>
    <text class="k-small" x="${DOCK.x + 24}" y="202">The arrow: the first policy the model reads</text>
    <g id="bucket"></g>
    <g class="model"><circle cx="${DOCK.x + 10}" cy="246" r="18"/><text x="${DOCK.x + 10}" y="250">model</text></g>
    <g id="bubble"><rect class="bubble" x="${DOCK.x + 36}" y="222" width="${DOCK.w - 36}" height="50" rx="10"/><text class="ans" id="ans1" x="${DOCK.x + 46}" y="242"></text><text class="ans" id="ans2" x="${DOCK.x + 46}" y="260"></text></g>
    <g id="meters"></g>`;
  for (const id of ["fish", "net", "netrect", "netlabel", "keylabel", "meshzone", "meshlabel"]) els[id] = els.svg.querySelector(`#${id}`);
  for (const id of ["bucket", "bubble", "ans1", "ans2", "meters"]) els[id] = els.dock.querySelector(`#${id}`);
  buildFish();
}

function buildFish() {
  els.fish.innerHTML = CHUNKS[pick.chunk].map((c, i) => `
    <g class="fish ${roleClass(c)}" id="f-${i}">
      <text class="rank" x="${FISH.x - 12}" y="${FISH.h / 2 + 4}"></text>
      <path class="body" transform="translate(${FISH.x},0)" d="${fishPath(FISH.w, FISH.h)}"/>
      <circle class="eye" cx="${FISH.x + FISH.w - 16}" cy="${FISH.h / 2 - 3}" r="2"/>
      <text class="fname" x="${FISH.x + 24}" y="${FISH.h / 2 + 4}">${esc(c.name)}</text>
      <text class="score k-code" x="${FISH.x + FISH.w + 14}" y="${FISH.h / 2 + 4}"></text>
    </g>`).join("");
  els.fishes = CHUNKS[pick.chunk].map((_, i) => els.fish.querySelector(`#f-${i}`));
  els.builtFor = pick.chunk;
}

function drawScene(r, a) {
  if (els.builtFor !== pick.chunk) buildFish();
  els.keylabel.textContent = pick.rerank ? "rerank" : "similarity";
  let filteredN = 0;
  for (const c of r.all) {
    const g = els.fishes[c.i];
    let x = 0;
    let y;
    if (c.filtered) { x = MESH.x - FISH.x + 14 + filteredN * 8; y = MESH.y + 13; filteredN += 1; }
    else y = ROW.y + c.rank * ROW.h;
    g.setAttribute("style", `transform: translate(${x}px, ${y}px)`);
    g.setAttribute("class", `fish ${roleClass(c)}${c.caught ? " caught" : ""}${c.filtered ? " filtered" : ""}`);
    const [rank, score] = [g.querySelector(".rank"), g.querySelector(".score")];
    rank.textContent = c.filtered ? "" : `#${c.rank + 1}`;
    score.textContent = c.filtered ? "" : c[r.key].toFixed(2);
  }
  els.meshzone.setAttribute("class", `meshzone${pick.filter ? " on" : ""}`);
  els.meshlabel.textContent = pick.filter ? "Thrown back before search: status is not current" : "Metadata filter off: nothing is thrown back";

  const n = Math.max(1, Math.min(pick.topK, r.eligible.length));
  els.netrect.setAttribute("y", String(ROW.y - 6));
  els.netrect.setAttribute("height", String(n * ROW.h + 2));
  const nx = FISH.x + FISH.w + 96;
  const ny = ROW.y - 6 + (n * ROW.h + 2) / 2;
  els.netlabel.setAttribute("x", String(nx));
  els.netlabel.setAttribute("y", String(ny));
  els.netlabel.setAttribute("transform", `rotate(90 ${nx} ${ny})`);
  els.netlabel.textContent = `net: top ${pick.topK}`;

  // The bucket, the model and its answer.
  const shown = cast ? r.net : [];
  els.bucket.innerHTML = shown.length
    ? shown.map((c, j) => {
      const y = 76 + j * 22;
      const reads = a.first && c.i === a.first.i;
      const arrow = reads ? `<path class="reads-arrow" d="M${DOCK.x + 10} 228 L${DOCK.x + 10} ${y + 6} L${DOCK.x + 18} ${y + 6}"/><path class="reads-head" d="M${DOCK.x + 18} ${y + 2} L${DOCK.x + 24} ${y + 6} L${DOCK.x + 18} ${y + 10} Z"/>` : "";
      return `${arrow}${miniFish(DOCK.x + 26, y, roleClass(c))}<text class="bname${reads ? " reads" : ""}" x="${DOCK.x + 60}" y="${y + 10}">${esc(c.name)}</text>`;
    }).join("")
    : `<text class="k-small" x="${DOCK.x + 12}" y="96">Empty. Predict, then cast the net.</text>`;
  els.bubble.setAttribute("class", cast ? `said ${a.kind}` : "said");
  els.ans1.textContent = cast ? a.lines[0] : "…";
  els.ans2.textContent = cast ? a.lines[1] : "";

  // The meters, drawn as fish.
  const top = 296;
  const p = r.net.length ? `${r.hit.length} of ${r.net.length}` : "—";
  const rc = `${r.hit.length} of ${r.want.length}`;
  const pIcons = cast ? r.net.map((c, j) => miniFish(DOCK.x + 12 + j * 32, top + 26, roleClass(c))).join("") : "";
  const rIcons = cast ? r.want.map((c, j) => miniFish(DOCK.x + 12 + j * 32, top + 88, c.caught ? "want" : "missed")).join("") : "";
  els.meters.innerHTML = `
    <text class="k-label" x="${DOCK.x}" y="${top + 12}">Precision${cast ? `: ${p}` : ""}</text>
    <text class="k-small" x="${DOCK.x + 12}" y="${top + 54}">${cast ? "fish in the net that you wanted" : "cast to score the net"}</text>
    ${pIcons}
    <text class="k-label" x="${DOCK.x}" y="${top + 74}">Recall${cast ? `: ${rc}` : ""}</text>
    <text class="k-small" x="${DOCK.x + 12}" y="${top + 116}">${cast ? (r.hit.length < r.want.length ? "wanted fish caught (dashed: still in the pond)" : "wanted fish the net caught") : "cast to score the net"}</text>
    ${rIcons}`;

  const summary = cast
    ? `Precision ${p}, recall ${rc}. The model answers ${a.lines.join(" ")}`
    : "Nothing caught yet.";
  els.svg.setAttribute("aria-label", `The pond holds ${r.all.length} chunks. The net takes the top ${pick.topK}${pick.filter ? " after the superseded FAQ is filtered out" : ""}.`);
  els.dock.setAttribute("aria-label", cast ? `The bucket holds ${r.net.map((c) => c.name).join("; ")}. ${summary}` : summary);
}

// ---- Controls -------------------------------------------------------------------------------

function build() {
  app.innerHTML = `
    <div class="panel predict">
      <p class="q"><strong>Predict first.</strong> A customer asks: “${esc(QUESTION)}” The net catches the top 3 chunks, and the current 2026 policy (30 days) is among them. What will the agent answer?</p>
      <div class="chips" role="group" aria-label="Your prediction">
        ${Object.entries(PREDICT).map(([k, v]) => `<button type="button" class="chip" data-predict="${k}" aria-pressed="false">${esc(v)}</button>`).join("")}
      </div>
      <p class="verdict" id="verdict"></p>
    </div>
    <div class="panel stage">
      <div class="scene">
        <div class="scroll pondwrap" tabindex="0" role="region" aria-label="The pond and the net"><svg id="svg" viewBox="0 0 460 440" role="img"></svg></div>
        <div class="dockwrap"><svg id="dock" viewBox="${DOCK.x - 12} 0 ${DOCK.w + 16} 430" role="img"></svg></div>
      </div>
      <p class="caption" id="caption" role="status"></p>
      <div class="controls">
        <div class="seg" role="group" aria-label="Chunk size"><span class="seglabel">Chunk size</span>
          ${Object.entries(SIZES).map(([k, v]) => `<button type="button" class="pill" data-chunk="${k}" aria-pressed="false">${esc(v)}</button>`).join("")}
        </div>
        <label class="seg" for="topk"><span class="seglabel">Net size: top <span id="kval"></span></span><input id="topk" type="range" min="1" max="6" step="1" /></label>
        <div class="seg" role="group" aria-label="Retrieval"><span class="seglabel">Retrieval</span>
          <button type="button" class="pill" id="rerank" aria-pressed="false">Rerank the catch</button>
          <button type="button" class="pill" id="filter" aria-pressed="false">Throw back superseded fish (metadata filter)</button>
        </div>
        <div class="buttons"><button type="button" class="primary" id="cast">Cast the net</button><button type="button" id="reset">Reset</button></div>
      </div>
    </div>
    <p class="legend">Green: a fish the right answer needs. Red: the superseded 2024 FAQ. Grey: off-topic. Precision@k = wanted fish in the net ÷ fish in the net; recall@k = wanted fish in the net ÷ all wanted fish. Scores are illustrative, scripted for this exercise: vector similarity, or reranker relevance when the catch is reranked.</p>`;
  els = {};
  for (const id of ["svg", "dock", "verdict", "caption", "topk", "kval", "rerank", "filter", "cast", "reset"]) els[id] = app.querySelector(`#${id}`);
  buildScene();
  app.querySelectorAll("[data-predict]").forEach((b) => b.addEventListener("click", () => { prediction = b.dataset.predict; sim.event("predicted", { prediction }); render(false); }));
  app.querySelectorAll("[data-chunk]").forEach((b) => b.addEventListener("click", () => change("chunk", b.dataset.chunk)));
  els.topk.addEventListener("input", () => change("topK", Number(els.topk.value)));
  els.rerank.addEventListener("click", () => change("rerank", !pick.rerank));
  els.filter.addEventListener("click", () => change("filter", !pick.filter));
  els.cast.addEventListener("click", () => { cast = true; render(true); });
  els.reset.addEventListener("click", () => { pick = { ...START }; render(); });
}

function change(key, value) {
  pick[key] = value;
  render(cast);
}

function captionText(r, a) {
  if (!cast) return "Green fish are what a correct answer needs. The red one is the 2024 refund FAQ: superseded, still in the corpus, and worded almost exactly like the question. Make your prediction, then cast the net.";
  const P = `precision ${r.hit.length}/${r.net.length || 0}`;
  const R = `recall ${r.hit.length}/${r.want.length}`;
  if (a.kind === "wrong") {
    const why = pick.rerank
      ? "The reranker made it worse: the superseded FAQ restates the question, so it scores highest of all."
      : pick.topK > 3
        ? "A bigger net only adds fish behind it; the superseded FAQ is still the first policy the model reads."
        : "The superseded FAQ ranks first because it restates the question.";
    return `Grounded, cited and wrong. The current policy is in the bucket (${R}), but ${P}, and the stale fish is the first policy the model reads, so it faithfully quotes 60 days. ${why} Throw it back before search.`;
  }
  if (a.kind === "none") return `No policy fish in the net (${R}): the model honestly says it can't find the answer. Widen the net.`;
  if (a.kind === "partial") return `Right window, but the final-sale rule is still in the pond (${R}). The filter removed the wrong answer; to complete it, rerank the catch or widen the net.`;
  return `Correct and complete (${P}, ${R}). The filter threw the superseded fish back before search, so the first policy the model reads is the current one.${r.hit.length < r.net.length ? " The grey fish left in the net are harmless noise: low precision costs tokens, but a stale fish costs the answer." : ""}`;
}

function verdictText() {
  if (!prediction || !firstResult) return "";
  const said = { right: "30 days", partial: "30 days", wrong: "60 days", none: "that it can't find it" }[firstResult];
  const hit = prediction === firstResult || (prediction === "right" && firstResult === "partial");
  if (firstResult === "wrong") {
    return hit
      ? "Right: the agent said 60 days. The 30-day policy was in the net, but the superseded FAQ ranked above it."
      : "Not quite: the agent said 60 days. The 30-day policy was in the net, but the superseded FAQ ranked above it and grounded the answer.";
  }
  return `${hit ? "Right" : "Not quite"}: on your first cast the agent said ${said}.`;
}

function render(animate) {
  const pressed = (sel, on) => app.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(on(b))));
  pressed("[data-predict]", (b) => b.dataset.predict === prediction);
  pressed("[data-chunk]", (b) => b.dataset.chunk === pick.chunk);
  els.rerank.setAttribute("aria-pressed", String(pick.rerank));
  els.filter.setAttribute("aria-pressed", String(pick.filter));
  els.topk.value = String(pick.topK);
  els.kval.textContent = String(pick.topK);
  els.cast.textContent = cast ? "Cast again" : "Cast the net";

  const r = retrieve();
  const a = answer(r.net);
  drawScene(r, a);
  els.caption.textContent = captionText(r, a);
  if (cast) {
    if (!firstResult) firstResult = a.kind;
    if (a.kind === "wrong") sawWrong = true;
    if (animate !== false) sim.event("retrieve", { chunk: pick.chunk, topK: pick.topK, rerank: pick.rerank, filter: pick.filter, result: a.kind });
    if (pick.filter && sawWrong && (a.kind === "right" || a.kind === "partial") && !reported) {
      reported = true;
      sim.checkpoint("observe-stale-grounding");
    }
  }
  els.verdict.textContent = verdictText();
  reportSize();
}

function readProps(props) {
  if (props && CHUNKS[props.chunk]) START.chunk = props.chunk;
  const k = Number(props && props.topK);
  if (Number.isFinite(k) && k >= 1 && k <= 6) START.topK = Math.floor(k);
  pick = { ...START };
}

const sim = createSim({
  onInit({ props, theme, reducedMotion }) {
    applyTheme(theme);
    if (reducedMotion) document.documentElement.classList.add("reduced");
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
