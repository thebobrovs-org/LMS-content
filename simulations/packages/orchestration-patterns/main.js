// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// One task (prepare a refund decision), run as a sequential, parallel or loop workflow.
// Each step finishes one agent run: the timeline shows when it ran, the state panel shows
// what it wrote. In the parallel pattern the two checks can write distinct keys or the
// same key; with the same key, the branch that finishes last overwrites the other.
// Everything is scripted and deterministic; times are illustrative seconds.

const app = document.getElementById("app");

const PATTERNS = {
  sequential: "Sequential",
  parallel: "Parallel",
  loop: "Loop",
};

// Build the run: a list of agent runs { agent, start, end, writes: [[key, value]], text, kind }.
function buildRun() {
  const runs = [];
  runs.push({ agent: "order_agent", start: 0, end: 2, writes: [["order", "A1234, 120 EUR, delivered 12 days ago"]], text: "Loads the order." });
  if (pattern === "sequential") {
    runs.push({ agent: "fraud_check", start: 2, end: 5, writes: [["fraud_result", "low risk"]], text: "Checks fraud risk." });
    runs.push({ agent: "policy_check", start: 5, end: 7, writes: [["policy_result", "within the 30-day window"]], text: "Checks the return policy." });
    runs.push(summary(7, true, true));
  } else if (pattern === "parallel") {
    const fraudKey = shared ? "check_result" : "fraud_result";
    const policyKey = shared ? "check_result" : "policy_result";
    // Both start at 2; policy finishes first (4), fraud last (5).
    runs.push({ agent: "policy_check", start: 2, end: 4, writes: [[policyKey, "within the 30-day window"]], text: "Checks the return policy (parallel branch)." });
    runs.push({ agent: "fraud_check", start: 2, end: 5, writes: [[fraudKey, "low risk"]], text: "Checks fraud risk (parallel branch).", overwrites: shared ? "policy_check" : null });
    runs.push(summary(5, true, !shared));
  } else {
    const FEEDBACK = ["Rejected: the refund amount is missing.", "Rejected: the return window is not stated.", "Approved."];
    let t = 2;
    let approved = false;
    for (let i = 1; i <= cap; i += 1) {
      const fb = FEEDBACK[Math.min(i, FEEDBACK.length) - 1];
      runs.push({ agent: "draft_writer", start: t, end: t + 1, writes: [["draft", `draft ${i}`]], text: `Writes draft ${i} of the refund note.` });
      t += 1;
      const ok = fb === "Approved.";
      const ends = ok && exitOn;
      runs.push({
        agent: "reviewer",
        start: t,
        end: t + 1,
        writes: [["review", ok ? "approved" : fb.replace("Rejected: ", "rejected: ")]],
        text: ends ? `${fb} Ends the loop (exit condition met).` : ok ? (i < cap ? `${fb} Nothing ends the loop, so it runs again.` : `${fb} Nothing ends the loop, but the cap is reached.`) : fb,
        kind: ok ? "good" : "",
      });
      t += 1;
      if (ok) approved = true;
      if (ends) break;
    }
    runs.push({
      agent: "loop",
      start: t,
      end: t,
      writes: [],
      text: approved
        ? exitOn
          ? "Loop ended by the reviewer's approval."
          : cap > 3
            ? `Loop stopped at the cap of ${cap} iterations, after work that changed nothing.`
            : `Loop stopped at the cap of ${cap}; approval did not end it.`
        : `Loop stopped at the cap of ${cap} iterations without an approved note.`,
      kind: approved ? (exitOn ? "good" : "bad") : "bad",
      marker: true,
    });
  }
  return runs;
}

function summary(start, hasFraud, hasPolicy) {
  const text = hasFraud && hasPolicy
    ? "Reads order, fraud_result and policy_result: “Approve the 120 EUR refund.”"
    : "Reads order and check_result, which now says only “low risk”: “Cannot confirm the return window, hand the refund to a person.”";
  return { agent: "summary_agent", start, end: start + 1, writes: [["decision", hasFraud && hasPolicy ? "approve" : "hand to a person (policy result lost)"]], text, kind: hasFraud && hasPolicy ? "good" : "bad" };
}

let pattern = "sequential";
let shared = false;
let cap = 4;
let exitOn = true;
let run = [];
let shown = 0;
let timer = null;
let collisionReported = false;
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

function resetRun() {
  stopAuto();
  run = buildRun();
  shown = 0;
}

function done() {
  return shown >= run.length;
}

function step() {
  if (done()) return false;
  shown += 1;
  if (done()) finish();
  return !done();
}

function finish() {
  const lost = run.some((r) => r.overwrites);
  if (lost && !collisionReported) {
    collisionReported = true;
    sim.checkpoint("observe-state-collision");
  }
  sim.event("run-finished", { pattern, shared, cap, exitOn, total: totalTime(), lost });
}

function totalTime() {
  return run.reduce((m, r) => Math.max(m, r.end), 0);
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
    render();
    if (done()) stopAuto();
  }, 800);
}

function build() {
  app.innerHTML = `
    <div class="controls">
      <label class="field">Pattern
        <select id="pattern">
          <option value="sequential">Sequential</option>
          <option value="parallel">Parallel</option>
          <option value="loop">Loop</option>
        </select>
      </label>
      <label class="check" id="shared-label"><input id="shared" type="checkbox" /> Parallel checks write the same key</label>
      <label class="field" for="cap" id="cap-label"><span class="nowrap">Loop max iterations: <span id="capval"></span></span>
        <input id="cap" type="range" min="1" max="6" step="1" />
      </label>
      <label class="check" id="exit-label"><input id="exit" type="checkbox" /> Reviewer approval ends the loop</label>
      <div class="buttons">
        <button id="step">Step</button>
        <button id="auto" class="secondary">Auto</button>
        <button id="reset" class="secondary">Reset</button>
      </div>
    </div>
    <p class="readout" id="readout" role="status"></p>
    <section class="timeline" aria-labelledby="tl-h">
      <h2 id="tl-h">Timeline (seconds)</h2>
      <ul class="lanes" id="lanes" aria-hidden="true"></ul>
      <div class="axis" aria-hidden="true"><span></span><span class="ticks" id="ticks"></span></div>
    </section>
    <section class="state" aria-labelledby="st-h">
      <h2 id="st-h">Session state</h2>
      <ul id="state"></ul>
    </section>
    <section class="log" aria-labelledby="log-h">
      <h2 id="log-h">Agent runs, in the order they finish</h2>
      <ol id="rows"></ol>
    </section>
    <p class="legend">Times are illustrative. Each Step finishes one agent run; the state panel shows each key's latest value.</p>`;
  els = {
    pattern: app.querySelector("#pattern"),
    shared: app.querySelector("#shared"),
    sharedLabel: app.querySelector("#shared-label"),
    cap: app.querySelector("#cap"),
    capLabel: app.querySelector("#cap-label"),
    capval: app.querySelector("#capval"),
    exit: app.querySelector("#exit"),
    exitLabel: app.querySelector("#exit-label"),
    step: app.querySelector("#step"),
    auto: app.querySelector("#auto"),
    reset: app.querySelector("#reset"),
    readout: app.querySelector("#readout"),
    lanes: app.querySelector("#lanes"),
    ticks: app.querySelector("#ticks"),
    state: app.querySelector("#state"),
    rows: app.querySelector("#rows"),
  };
  els.pattern.value = pattern;
  els.shared.checked = shared;
  els.cap.value = String(cap);
  els.exit.checked = exitOn;
  els.pattern.addEventListener("change", () => { pattern = els.pattern.value; resetRun(); render(); });
  els.shared.addEventListener("change", () => { shared = els.shared.checked; resetRun(); render(); });
  els.cap.addEventListener("input", () => { cap = Number(els.cap.value); resetRun(); render(); });
  els.exit.addEventListener("change", () => { exitOn = els.exit.checked; resetRun(); render(); });
  els.step.addEventListener("click", () => { stopAuto(); step(); render(); });
  els.auto.addEventListener("click", () => { if (timer) stopAuto(); else startAuto(); });
  els.reset.addEventListener("click", () => { resetRun(); render(); });
}

function render() {
  const isPar = pattern === "parallel";
  const isLoop = pattern === "loop";
  els.shared.disabled = !isPar;
  els.sharedLabel.classList.toggle("disabled", !isPar);
  els.cap.disabled = !isLoop;
  els.exit.disabled = !isLoop;
  els.capLabel.classList.toggle("disabled", !isLoop);
  els.exitLabel.classList.toggle("disabled", !isLoop);
  els.capval.textContent = String(cap);

  const visible = run.slice(0, shown);
  const total = Math.max(totalTime(), 1);

  // Timeline: one lane per agent, bars for finished runs.
  const agents = [];
  for (const r of run) if (!r.marker && !agents.includes(r.agent)) agents.push(r.agent);
  els.lanes.innerHTML = agents
    .map((a) => {
      const bars = visible
        .filter((r) => r.agent === a && !r.marker)
        .map((r) => {
          const lostBar = isPar && shared && a === "policy_check" && visible.some((v) => v.overwrites);
          return `<span class="bar${lostBar ? " lost" : ""}" style="left:${(r.start / total) * 100}%;width:${((r.end - r.start) / total) * 100}%"></span>`;
        })
        .join("");
      return `<li class="lane"><span class="name mono">${esc(a)}</span><span class="track">${bars}</span></li>`;
    })
    .join("");
  const ticks = [];
  for (let t = 0; t <= total; t += total > 10 ? 2 : 1) ticks.push(`<span>${t}</span>`);
  els.ticks.innerHTML = ticks.join("");

  // State: latest value per key, flagging an overwritten write.
  const state = new Map();
  let overwritten = null;
  for (const r of visible) {
    for (const [k, v] of r.writes) {
      if (state.has(k) && r.overwrites) overwritten = { key: k, lost: state.get(k).value, by: r.agent };
      state.set(k, { value: v, by: r.agent });
    }
  }
  els.state.innerHTML = state.size
    ? [...state.entries()]
        .map(([k, { value, by }]) => {
          const over = overwritten && overwritten.key === k ? ` <span class="over">(overwrote “${esc(overwritten.lost)}” from policy_check)</span>` : "";
          return `<li><span class="key mono">${esc(k)}</span> = “${esc(value)}” <span class="note">by ${esc(by)}</span>${over}</li>`;
        })
        .join("")
    : `<li class="empty">Empty. Press Step or Auto.</li>`;

  // Log.
  const rows = visible.map((r) => {
    const t = r.marker ? `t = ${r.end}` : `${r.start}–${r.end} s`;
    const writes = r.writes.length ? `<span class="note">Writes ${r.writes.map(([k]) => `<span class="mono">${esc(k)}</span>`).join(", ")}.</span>` : "";
    const cls = r.overwrites ? "bad" : r.kind || "";
    const who = r.marker ? "Workflow" : r.agent;
    const over = r.overwrites ? `<span class="note">Same key as policy_check, so the policy result is overwritten.</span>` : "";
    return `<li class="row ${cls}"><span class="t">${esc(t)}</span><span><span class="mono">${esc(who)}</span>: ${esc(r.text)}${writes}${over}</span></li>`;
  });
  if (!done()) {
    const next = run[shown].marker ? "the loop checks whether to stop" : `${run[shown].agent} finishes`;
    rows.push(`<li class="pending">Next: ${esc(next)}. Press Step or Auto.</li>`);
  }
  els.rows.innerHTML = rows.join("");

  // Readout.
  const finished = done();
  const last = run[run.length - 1];
  let text;
  let cls = "readout";
  if (!finished) {
    text = `${PATTERNS[pattern]} workflow: ${shown} of ${run.length} steps.`;
  } else if (last.kind === "bad") {
    cls += " stopped";
    text = isPar
      ? `Finished in ${totalTime()} s, but the policy result was overwritten, so the summary could not decide.`
      : `${last.text} Total ${totalTime()} s.`;
  } else {
    cls += " done";
    text = isLoop ? `${last.text} Total ${totalTime()} s.` : `Finished in ${totalTime()} s with every result in state.`;
  }
  els.readout.className = cls;
  els.readout.textContent = text;
  reportSize();
}

function readProps(props) {
  if (props && PATTERNS[props.pattern]) pattern = props.pattern;
}

document.addEventListener("visibilitychange", () => { if (document.hidden) stopAuto(); });

const sim = createSim({
  onInit({ props, theme }) {
    applyTheme(theme);
    readProps(props);
    build();
    resetRun();
    render();
  },
});

// Fallback for opening the bundle directly (no host init).
setTimeout(() => {
  if (!sim.isInitialized() && app.childElementCount === 0) {
    build();
    resetRun();
    render();
  }
}, 300);
