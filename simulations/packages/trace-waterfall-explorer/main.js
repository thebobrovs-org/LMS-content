// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// Trace waterfall: fix the slow turn (topics/agentic-ai/agent-observability-troubleshooting.mdx).
// The lesson's trace (media/agent-trace-waterfall.svg): one 13.6 s turn against a 4 s target,
// with search_flights repeated four times with the same arguments (A, a reasoning loop) and a
// 6.6 s get_fare_rules call (B, a slow tool). The learner clicks the spans they blame and picks
// a fix for each; the turn total is recomputed from the figure's span durations. The lesson's
// fixes: a clear "no flights match" result, a stop instruction and the run cap for the loop
// (a timeout is not a loop fix); a cache per fare class for the slow tool (a faster model would
// barely move the total). A cache hit is counted as 0 s, which the legend labels illustrative.
// Deterministic; no motion.

const app = document.getElementById("app");

const TARGET = 4;
// Two layouts. Wide (a drawing of 640 px or more): span names in a column left of the bars.
// Narrow (phones): each span's name on its own line above its bar, drawn at 1:1 so text stays legible.
const WIDE = { w: 700, scale: 31.4, x0: 238, row0: 30, rowH: 24, nameDy: 16, barDy: 3, barH: 18, nameX: 20, duRight: false };
const NARROW = { w: 320, scale: 21, x0: 12, row0: 30, rowH: 34, nameDy: 12, barDy: 16, barH: 14, nameX: 12, duRight: true };
let G = WIDE;
let SCALE, X0, ROW0, ROW_H;
const isNarrow = () => (window.innerWidth || 1100) < 700;
function setGeom() {
  G = isNarrow() ? NARROW : WIDE;
  ({ scale: SCALE, x0: X0, row0: ROW0, rowH: ROW_H } = G);
}

// The figure's child spans, in order. group: "A" (the loop), "B" (the slow tool) or none.
// cut: removed by the loop guard (the three repeat searches and the model calls that re-issued them).
const SPANS = [
  { name: "generate_content gemini", kind: "model", d: 0.9 },
  { name: "execute_tool search_flights", kind: "tool", d: 0.4, group: "A" },
  { name: "generate_content gemini", kind: "model", d: 0.8, group: "A", cut: true },
  { name: "execute_tool search_flights", kind: "tool", d: 0.4, group: "A", cut: true },
  { name: "generate_content gemini", kind: "model", d: 0.8, group: "A", cut: true },
  { name: "execute_tool search_flights", kind: "tool", d: 0.4, group: "A", cut: true },
  { name: "generate_content gemini", kind: "model", d: 0.8, group: "A", cut: true },
  { name: "execute_tool search_flights", kind: "tool", d: 0.4, group: "A", cut: true },
  { name: "generate_content gemini", kind: "model", d: 0.9 },
  { name: "execute_tool get_fare_rules", kind: "tool", d: 6.6, group: "B" },
  { name: "generate_content gemini", kind: "model", d: 1.2 },
];

const GROUPS = {
  A: {
    title: "A: reasoning loop",
    blame: "A: reasoning loop. search_flights runs four times with the same arguments, each followed by a model call. The three repeats and the model calls that re-issued them add 3.6 s. Pick a fix.",
    fixes: [
      { id: "guard", label: "Loop guard: clear empty result, stop instruction, run cap", works: true,
        text: "Loop guard: search_flights now says \"no flights match; try another fare class or date\", the agent asks the user, and the max_llm_calls cap stays as a safety net. The three repeats are gone: 3.6 s saved." },
      { id: "timeout", label: "A longer timeout", works: false,
        text: "No change. A timeout is not a loop fix: more time buys more repeats, more tokens and a later failure." },
    ],
  },
  B: {
    title: "B: slow tool",
    blame: "B: slow tool. get_fare_rules calls a slow partner API and takes 6.6 of the 13.6 s. That is not the agent's reasoning. Pick a fix.",
    fixes: [
      { id: "cache", label: "Cache fare rules per fare class", works: true,
        text: "Cache: fare rules change rarely, so they are cached for each fare class. On a cache hit get_fare_rules drops out of the turn: 6.6 s saved." },
      { id: "model", label: "A faster model", works: false,
        text: "No change. get_fare_rules is a slow downstream API, not the agent's reasoning. Making the model faster would barely move the total." },
    ],
  },
};

const PREDICT = [
  { id: "A", label: "Fix the search loop (A)" },
  { id: "B", label: "Fix the slow get_fare_rules (B)" },
  { id: "model", label: "A faster model" },
];

let selected = null; // span index, or "root"
let fixes = { A: null, B: null };
let message = null;
let prediction = null;
let reported = false;
let els = {};

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8)); }
const s1 = (n) => `${n.toFixed(1)} s`;

const works = (g, f = fixes) => !!f[g] && GROUPS[g].fixes.find((x) => x.id === f[g]).works;
function removed(i, f = fixes) {
  const s = SPANS[i];
  return (s.cut && works("A", f)) || (s.group === "B" && works("B", f));
}
function total(f = fixes) {
  let t = 0;
  SPANS.forEach((s, i) => { if (!removed(i, f)) t += s.d * 10; });
  return t / 10;
}
const bothFixed = () => works("A") && works("B");

// ---- Drawing --------------------------------------------------------------------------------

function rowSvg(s, i) {
  const y = ROW0 + (i + 1) * ROW_H;
  return `<g class="span ${s.kind}" id="s-${i}" data-i="${i}" role="button" tabindex="0" aria-pressed="false" aria-label="${s.name}, ${s.d} seconds">
      <rect class="hit" x="0" y="${y}" width="${G.w}" height="${ROW_H}"/>
      <text class="nm k-code" x="${G.nameX}" y="${y + G.nameDy}">${s.name}</text>
      <rect class="bar" id="b-${i}" y="${y + G.barDy}" height="${G.barH}" rx="4"/>
      <text class="du" id="d-${i}" y="${y + G.nameDy}"${G.duRight ? ` x="${G.w - 12}" text-anchor="end"` : ""}></text>
    </g>`;
}

function build() {
  app.innerHTML = `
    <details class="panel predict" open id="predict">
      <summary class="q">Predict: which single fix gets this 13.6 s turn closest to the 4 s target?</summary>
      <div class="chips" role="group" aria-label="Your prediction">
        ${PREDICT.map((p) => `<button type="button" class="chip" data-predict="${p.id}" aria-pressed="false">${p.label}</button>`).join("")}
      </div>
      <p class="verdict" id="verdict"></p>
    </details>
    <div class="panel stage">
      <div class="scroll" tabindex="0" role="region" aria-label="The trace waterfall" id="scroll"></div>
      <p class="caption" id="caption" role="status"></p>
      <div class="fixbox" id="fixbox">
        <h2 id="fixtitle"></h2>
        <div class="chips" role="group" aria-labelledby="fixtitle">
          <button type="button" class="chip" id="fix-0" data-fix="0" aria-pressed="false"></button>
          <button type="button" class="chip" id="fix-1" data-fix="1" aria-pressed="false"></button>
        </div>
      </div>
      <div class="tiles">
        <div class="tile"><span class="tlb">Turn total</span><span class="tv" id="t-total"></span></div>
        <div class="tile"><span class="tlb">Against 4 s</span><span class="tv" id="t-gap"></span></div>
      </div>
      <div class="controls"><div class="buttons"><button type="button" id="reset">Reset</button></div></div>
    </div>
    <p class="legend">User: "Move my Tuesday flight to Friday." Violet: model calls. Teal: tool calls. Amber dashed: the 4 s target. Durations are the figure's; a cache hit counts as 0 s here (illustrative).</p>`;
  els = {};
  for (const id of ["scroll", "caption", "verdict", "fixbox", "fixtitle", "fix-0", "fix-1", "t-total", "t-gap"]) els[id] = app.querySelector(`#${id}`);
  drawSvg();
  app.querySelectorAll("[data-fix]").forEach((b) => b.addEventListener("click", () => applyFix(Number(b.dataset.fix))));
  app.querySelectorAll("[data-predict]").forEach((b) => b.addEventListener("click", () => {
    prediction = b.dataset.predict;
    app.querySelectorAll("[data-predict]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    sim.event("predicted", { prediction });
    check();
    render();
  }));
  app.querySelector("#reset").addEventListener("click", () => { selected = null; fixes = { A: null, B: null }; message = null; render(); });
}

// Writes the drawing for the current layout; called again only when the layout changes.
function drawSvg() {
  setGeom();
  const ticks = [0, 2, 4, 6, 8, 10, 12, 14].map((t) => {
    const x = X0 + t * SCALE;
    return `<line class="grid" x1="${x}" y1="${ROW0 - 4}" x2="${x}" y2="${ROW0 + 12 * ROW_H}"/><text class="k-small" x="${x}" y="${ROW0 - 8}" text-anchor="middle">${t} s</text>`;
  }).join("");
  const tx = X0 + TARGET * SCALE;
  els.scroll.innerHTML = `
        <svg viewBox="0 0 ${G.w} ${ROW0 + 12 * ROW_H + 22}" role="img" id="drawing" class="${G === WIDE ? "wide" : "narrow"}" aria-label="">
          ${ticks}
          <g class="span root" id="s-root" data-i="root" role="button" tabindex="0" aria-pressed="false" aria-label="invoke_agent travel_agent, the whole turn">
            <rect class="hit" x="0" y="${ROW0}" width="${G.w}" height="${ROW_H}"/>
            <text class="nm k-code" x="${G === WIDE ? 8 : G.nameX}" y="${ROW0 + G.nameDy}">invoke_agent travel_agent</text>
            <rect class="bar" id="b-root" x="${X0}" y="${ROW0 + G.barDy}" height="${G.barH}" rx="4"/>
            <text class="du strong" id="d-root" y="${ROW0 + G.nameDy}"${G.duRight ? ` x="${G.w - 12}" text-anchor="end"` : ""}></text>
          </g>
          ${SPANS.map(rowSvg).join("")}
          <line class="target" x1="${tx}" y1="${ROW0 - 4}" x2="${tx}" y2="${ROW0 + 12 * ROW_H + 4}"/>
          <text class="tl" x="${tx + 4}" y="${ROW0 + 12 * ROW_H + 16}">4 s target</text>
          <text class="tag" id="tag-A" x="0" y="0">A</text>
          <text class="tag" id="tag-B" x="0" y="0">B</text>
        </svg>
`;
  els.drawing = els.scroll.querySelector("#drawing");
  els.scroll.querySelectorAll(".span").forEach((g) => {
    const pick = () => select(g.dataset.i === "root" ? "root" : Number(g.dataset.i));
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
  });
}

window.addEventListener("resize", () => {
  if (!els.scroll || (G === NARROW) === isNarrow()) return;
  drawSvg();
  render();
});

const groupOf = () => (selected === null || selected === "root" ? null : SPANS[selected].group || null);

function select(i) {
  selected = i;
  const g = groupOf();
  if (i === "root") message = `invoke_agent is the whole turn: ${s1(total())}. Its child spans show where the time went.`;
  else if (g) message = GROUPS[g].blame;
  else message = `generate_content gemini: one model call, ${s1(SPANS[i].d)}. Not where the time went: making the model faster would barely move the total.`;
  sim.event("span-blamed", { span: i, group: g });
  render();
}

function applyFix(k) {
  const g = groupOf();
  if (!g) return;
  const fix = GROUPS[g].fixes[k];
  fixes = { ...fixes, [g]: fix.id };
  message = fix.text;
  sim.event("fix-applied", { group: g, fix: fix.id, total: total() });
  if (bothFixed()) message = `Both fixed: the turn takes ${s1(total())}, under the 4 s target. The loop guard alone leaves ${s1(total({ A: "guard", B: null }))}; the cache alone leaves ${s1(total({ A: null, B: "cache" }))}. Then re-run the offline evaluation dataset to confirm.`;
  check();
  render();
}

function check() {
  if (!reported && prediction && bothFixed()) {
    reported = true;
    sim.checkpoint("observe-trace-fixes");
  }
}

function render() {
  const g = groupOf();
  let t = 0;
  const ends = { A: 0, B: 0, A1: 0 };
  SPANS.forEach((s, i) => {
    const gone = removed(i);
    const bar = app.querySelector(`#b-${i}`);
    const du = app.querySelector(`#d-${i}`);
    const x = X0 + t * SCALE;
    const w = gone ? 0 : s.d * SCALE;
    bar.setAttribute("x", x.toFixed(1));
    bar.setAttribute("width", Math.max(w, 0).toFixed(1));
    if (!G.duRight) du.setAttribute("x", (x + w + 4).toFixed(1));
    du.textContent = gone ? (s.group === "B" ? "cache hit" : "removed") : s1(s.d);
    const blamed = !!s.group && (g === s.group || !!fixes[s.group]);
    const node = app.querySelector(`#s-${i}`);
    node.setAttribute("class", `span ${s.kind}${gone ? " gone" : ""}${blamed ? " blamed" : ""}${selected === i ? " sel" : ""}`);
    node.setAttribute("aria-pressed", String(selected === i));
    if (s.group === "A" && !gone) ends.A = Math.max(ends.A, x + w + 34);
    if (i === 1) ends.A1 = x + w + 34;
    if (s.group === "B") ends.B = x + w + (gone ? 64 : 34);
    if (!gone) t = Math.round((t + s.d) * 10) / 10;
  });
  const tt = total();
  const root = app.querySelector("#b-root");
  root.setAttribute("width", (tt * SCALE).toFixed(1));
  const dr = app.querySelector("#d-root");
  if (!G.duRight) dr.setAttribute("x", String(X0 + 6));
  dr.textContent = s1(tt);
  const rs = app.querySelector("#s-root");
  rs.setAttribute("class", `span root ${tt <= TARGET ? "ok" : "over"}${selected === "root" ? " sel" : ""}`);
  rs.setAttribute("aria-pressed", String(selected === "root"));

  // A and B tags appear once the learner has blamed that group.
  for (const k of ["A", "B"]) {
    const tag = app.querySelector(`#tag-${k}`);
    const shown = g === k || !!fixes[k];
    const rowY = (k === "A" ? ROW0 + (works("A") ? 2 : 5) * ROW_H : ROW0 + 10 * ROW_H) + G.nameDy;
    const x = G.duRight ? 226 : k === "A" && works("A") ? ends.A1 : ends[k];
    tag.setAttribute("x", x.toFixed(1));
    tag.setAttribute("y", String(rowY));
    tag.setAttribute("class", `tag t${k}${shown ? "" : " gone"}`);
  }

  // Fix chips for the blamed group.
  els.fixbox.hidden = !g;
  if (g) {
    els.fixtitle.textContent = `Fix ${GROUPS[g].title}`;
    GROUPS[g].fixes.forEach((f, k) => {
      const b = els[`fix-${k}`];
      b.textContent = f.label;
      b.setAttribute("aria-pressed", String(fixes[g] === f.id));
    });
  }

  els.caption.textContent = message || "One turn took 13.6 s against a 4 s target. Click the spans you blame for the slow turn.";
  els["t-total"].textContent = s1(tt);
  els["t-total"].className = `tv ${tt <= TARGET ? "pos" : "neg"}`;
  const gap = Math.round((tt - TARGET) * 10) / 10;
  els["t-gap"].textContent = gap > 0 ? `${s1(gap)} over` : `${s1(-gap)} under`;
  els["t-gap"].className = `tv ${gap > 0 ? "neg" : "pos"}`;
  els.drawing.setAttribute("aria-label", `Trace waterfall of one agent turn: ${s1(tt)} against a 4 second target. search_flights runs four times with the same arguments${works("A") ? ", now cut to one by the loop guard" : ""}; get_fare_rules takes 6.6 seconds${works("B") ? ", now a cache hit" : ""}.`);

  let verdict = "";
  if (prediction && bothFixed()) {
    const a = s1(total({ A: "guard", B: null }));
    const b = s1(total({ A: null, B: "cache" }));
    verdict = prediction === "B"
      ? `You predicted the slow tool: right. The cache alone leaves ${b}, the loop guard alone ${a}. Only both get under 4 s.`
      : prediction === "A"
        ? `You predicted the loop. The loop guard alone leaves ${a}; the cache for get_fare_rules alone leaves ${b}, closer. Only both get under 4 s.`
        : `You predicted a faster model. The time is in get_fare_rules and the loop, so it would barely move the total. The cache alone leaves ${b}, the loop guard ${a}.`;
  }
  els.verdict.textContent = verdict;
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
  if (!sim.isInitialized() && app.childElementCount === 0) { build(); render(); }
}, 300);
