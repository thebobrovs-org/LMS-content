// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// The point of no return. The same refund rides two tracks at once. On the top track the
// human approval stands before issue_refund (ADK tool confirmation: FunctionTool(...,
// require_confirmation=True, or a function of the arguments such as amount > threshold));
// a rejection means the tool never runs and the model receives
// {"error": "This tool call is rejected."} (adk-python tools/function_tool.py). On the
// bottom track the review runs after the tool (an after_tool_callback), so by the time the
// reviewer answers, the coins have already left the vault. One decision drives both
// signals, so one Deny shows both outcomes. Fictional store, amounts and threshold;
// deterministic. Motion only while a run plays; none when hidden or under reduced motion.

const app = document.getElementById("app");

const START = 5000;
const AMOUNTS = { large: 400, small: 40 };
const X0 = 112; // trains start here, just right of the model
const LINE = 400; // issue_refund runs here: money moves
const SIG = { top: 300, bottom: 520 };
const END = 690;
const Y = { top: 120, bottom: 290 };
const PREDICT = { top: "Top track", bottom: "Bottom track", both: "Both", neither: "Neither" };

let amountKey = "large";
let threshold = 0; // ask for approval on refunds above this
let reduced = false;
let prediction = null;

let lanes = {};
let phase = "ready"; // ready | running | waiting | done
let decision = null; // null | "approve" | "deny" | "auto"
let anim = null;
let reported = false;
let els = {};

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

const eur = (n) => `€${n.toLocaleString("en-US")}`;

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

function amount() {
  return AMOUNTS[amountKey];
}

function asks() {
  return amount() > threshold;
}

function resetRun() {
  stopAnim();
  lanes = {
    top: { x: X0, paid: 0, signal: asks() ? "wait" : "auto", state: "idle", stamp: false, coins: -1 },
    bottom: { x: X0, paid: 0, signal: asks() ? "wait" : "auto", state: "idle", stamp: false, coins: -1 },
  };
  phase = "ready";
  decision = null;
}

// ---- Run logic ----------------------------------------------------------------------------

// Segments a lane travels before the human is asked (or to the end when nobody is asked).
function firstLeg(name) {
  if (!asks()) return END;
  return name === "top" ? SIG.top - 40 : SIG.bottom - 40;
}

function send() {
  if (phase === "running" || phase === "waiting") return;
  if (phase === "done") resetRun();
  phase = "running";
  sim.event("refund-sent", { amount: amount(), threshold });
  animate({ top: firstLeg("top"), bottom: firstLeg("bottom") }, () => {
    if (asks()) {
      phase = "waiting";
      render();
      els.deny.focus();
    } else {
      decision = "auto";
      finish();
    }
  });
  render();
}

function decide(choice) {
  if (phase !== "waiting") return;
  decision = choice;
  phase = "running";
  lanes.top.signal = choice === "approve" ? "go" : "stop";
  lanes.bottom.signal = choice === "approve" ? "go" : "stop";
  sim.event("approver-decided", { choice, amount: amount() });
  els.send.focus();
  if (choice === "deny") {
    lanes.top.state = "rejected";
    lanes.bottom.stamp = true;
    render();
    finish();
    return;
  }
  animate({ top: END, bottom: END }, finish);
  render();
}

function finish() {
  phase = "done";
  sim.event("run-finished", { decision, amount: amount(), topPaid: lanes.top.paid, bottomPaid: lanes.bottom.paid });
  if (decision === "deny" && !reported) {
    reported = true;
    sim.checkpoint("observe-approval-before-side-effect");
  }
  render();
}

// ---- Motion -------------------------------------------------------------------------------

// Move both trains to their targets together. A train that crosses LINE pays at that moment.
function animate(targets, done) {
  const from = { top: lanes.top.x, bottom: lanes.bottom.x };
  const dur = reduced || document.hidden ? 0 : 1500;
  anim = { from, targets, t0: null, dur, done };
  if (dur === 0) { settle(1); const d = anim.done; anim = null; d(); return; }
  requestAnimationFrame(frame);
}

function settle(k) {
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  for (const name of ["top", "bottom"]) {
    const L = lanes[name];
    const x = anim.from[name] + (anim.targets[name] - anim.from[name]) * e;
    if (L.paid === 0 && x >= LINE) {
      L.paid = amount();
      L.coinsAt = k;
      sim.event("money-moved", { track: name });
    }
    L.x = x;
    L.coins = L.paid && k < 1 ? Math.min(1, (k - L.coinsAt) / 0.45) : -1;
  }
}

function frame(t) {
  if (!anim) return;
  if (anim.t0 === null) anim.t0 = t;
  const k = anim.dur ? Math.min(1, (t - anim.t0) / anim.dur) : 1;
  settle(k);
  draw();
  if (k < 1) { requestAnimationFrame(frame); return; }
  for (const name of ["top", "bottom"]) lanes[name].coins = -1;
  const d = anim.done;
  anim = null;
  d();
}

function stopAnim() {
  anim = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && anim) anim.dur = 0;
});

// ---- Drawing ------------------------------------------------------------------------------

function laneSvg(name, title, code) {
  const y = Y[name];
  const sx = SIG[name];
  return `
    <g class="lane">
      <text x="24" y="${y - 62}" class="lt">${title}</text>
      <text x="24" y="${y - 44}" class="lc">${code}</text>
      <line x1="40" y1="${y}" x2="${END + 40}" y2="${y}" class="rail"/>
      <line x1="40" y1="${y + 8}" x2="${END + 40}" y2="${y + 8}" class="rail"/>
      <g transform="translate(50,${y + 4})" class="station"><rect x="-26" y="-18" width="52" height="36" rx="8"/><text y="4">Model</text></g>
      <g transform="translate(${END + 22},${y + 4})" class="station"><rect x="-30" y="-18" width="60" height="36" rx="8"/><text y="4">Reply</text></g>
      <g class="vault" transform="translate(${LINE},${y + 52})">
        <rect x="-62" y="-17" width="124" height="34" rx="8"/>
        <text y="5" id="${name}-vault"></text>
      </g>
      <g class="wallet" transform="translate(${END - 40},${y + 52})">
        <rect x="-52" y="-17" width="104" height="34" rx="8"/>
        <text y="5" id="${name}-wallet"></text>
      </g>
      <g id="${name}-signal" class="signal" transform="translate(${sx},${y})">
        <rect x="-4" y="-50" width="8" height="46" rx="3" class="post"/>
        <rect x="-15" y="-80" width="30" height="34" rx="8" class="head"/>
        <circle cy="-63" r="10" class="lamp"/>
        <text y="-88" class="sl" id="${name}-sl"></text>
      </g>
      <g id="${name}-coins">${[0, 1, 2, 3, 4].map(() => '<g class="coin" opacity="0"><circle r="8"/><text y="3">€</text></g>').join("")}</g>
      <g id="${name}-train" class="train">
        <rect x="-34" y="-17" width="68" height="30" rx="10"/>
        <text y="3" id="${name}-tt"></text>
      </g>
      <g id="${name}-stamp" class="stamp" opacity="0"><rect x="-50" y="-13" width="100" height="26" rx="3"/><text y="5">TOO LATE</text></g>
    </g>`;
}

function build() {
  app.innerHTML = `
    <div class="panel predict" id="predict">
      <p class="q">Predict first: you will <strong>deny</strong> this refund. Which track keeps the money in the vault?</p>
      <div class="chips" role="group" aria-label="Your prediction">
        ${Object.entries(PREDICT).map(([k, v]) => `<button type="button" class="chip" data-predict="${k}" aria-pressed="false">${v}</button>`).join("")}
      </div>
      <p class="verdict" id="verdict"></p>
    </div>
    <div class="panel stage">
      <div class="scroll" tabindex="0" role="region" aria-label="The two tracks"><svg viewBox="0 0 760 400" role="img" aria-label="The same refund rides two tracks. On the top track the approval signal stands before the line where issue_refund pays out; on the bottom track the review signal stands after it.">
        <g class="noreturn">
          <rect x="${LINE - 12}" y="40" width="24" height="324" rx="8"/>
          <text x="${LINE}" y="386" class="nl">issue_refund runs here: money moves</text>
        </g>
        ${laneSvg("top", "Approval before the tool", "require_confirmation=True")}
        ${laneSvg("bottom", "Review after the tool", "after_tool_callback → review")}
      </svg></div>
      <p class="caption" id="caption" role="status"></p>
      <div class="decide" id="decide" hidden>
        <span class="who">Both signals are waiting for you, the approver.</span>
        <button type="button" id="approve" class="ok">Approve</button>
        <button type="button" id="deny" class="no">Deny</button>
      </div>
      <div class="controls">
        <div class="seg" role="group" aria-label="Refund">
          <span class="seglabel">Refund</span>
          <button type="button" class="pill" data-amount="large" aria-pressed="true">€400 chair</button>
          <button type="button" class="pill" data-amount="small" aria-pressed="false">€40 mug</button>
        </div>
        <label class="field" for="threshold">Ask for approval on refunds over <strong id="thv"></strong>
          <input id="threshold" type="range" min="0" max="500" step="20" />
        </label>
        <div class="buttons">
          <button type="button" id="send" class="primary">Send refund</button>
          <button type="button" id="reset" class="secondary">Reset</button>
        </div>
      </div>
    </div>
    <div class="tiles">
      <div class="tile"><span class="tl">Top vault</span><span class="tv mono" id="t-top"></span></div>
      <div class="tile"><span class="tl">Bottom vault</span><span class="tv mono" id="t-bottom"></span></div>
      <div class="tile"><span class="tl">Your call</span><span class="tv" id="t-call"></span></div>
    </div>
    <p class="legend">A fictional store and refund. Both tracks start from the same €5,000 and get the same decision, so the only difference is where the signal stands.</p>`;
  els = {};
  for (const id of ["predict", "verdict", "caption", "decide", "approve", "deny", "threshold", "thv", "send", "reset", "t-top", "t-bottom", "t-call"]) els[id] = app.querySelector(`#${id}`);
  for (const name of ["top", "bottom"]) {
    for (const part of ["vault", "wallet", "signal", "sl", "coins", "train", "tt", "stamp"]) els[`${name}-${part}`] = app.querySelector(`#${name}-${part}`);
  }
  els.threshold.value = String(threshold);
  app.querySelectorAll("[data-predict]").forEach((b) => b.addEventListener("click", () => {
    prediction = b.dataset.predict;
    app.querySelectorAll("[data-predict]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    sim.event("predicted", { prediction });
    render();
  }));
  app.querySelectorAll("[data-amount]").forEach((b) => b.addEventListener("click", () => {
    amountKey = b.dataset.amount;
    app.querySelectorAll("[data-amount]").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    resetRun();
    render();
  }));
  els.threshold.addEventListener("input", () => { threshold = Number(els.threshold.value); resetRun(); render(); });
  els.send.addEventListener("click", send);
  els.reset.addEventListener("click", () => { resetRun(); render(); });
  els.approve.addEventListener("click", () => decide("approve"));
  els.deny.addEventListener("click", () => decide("deny"));
}

function draw() {
  for (const name of ["top", "bottom"]) {
    const L = lanes[name];
    const y = Y[name];
    const shake = L.state === "rejected" ? " rejected" : "";
    els[`${name}-train`].setAttribute("transform", `translate(${L.x.toFixed(1)},${y})`);
    els[`${name}-train`].setAttribute("class", `train${L.paid ? " paid" : ""}${shake}`);
    els[`${name}-tt`].textContent = (L.state === "rejected" ? "✕ " : "") + eur(amount());
    els[`${name}-stamp`].setAttribute("opacity", L.stamp ? "1" : "0");
    els[`${name}-stamp`].setAttribute("transform", `translate(${L.x.toFixed(1)},${y - 34}) rotate(-10)`);
    els[`${name}-vault`].textContent = `Vault ${eur(START - L.paid)}`;
    els[`${name}-wallet`].textContent = L.paid ? `Customer +${eur(L.paid)}` : "Customer €0";
    const coins = els[`${name}-coins`].children;
    for (let i = 0; i < coins.length; i++) {
      const k = L.coins < 0 ? -1 : L.coins * 1.5 - i * 0.12;
      if (k <= 0 || k >= 1) { coins[i].setAttribute("opacity", "0"); continue; }
      const x = LINE + (END - 40 - LINE) * k;
      const cy = y + 52 - Math.sin(k * Math.PI) * 40;
      coins[i].setAttribute("opacity", "1");
      coins[i].setAttribute("transform", `translate(${x.toFixed(1)},${cy.toFixed(1)})`);
    }
    const sig = L.signal;
    els[`${name}-signal`].setAttribute("class", `signal ${sig}`);
    els[`${name}-sl`].textContent = sig === "auto" ? `≤ ${eur(threshold)}: no ask` : sig === "wait" ? "approval" : sig === "go" ? "approved" : "denied";
  }
}

function captionText() {
  const a = eur(amount());
  if (phase === "ready") {
    return asks()
      ? `The model proposes issue_refund(amount=${amount()}). Press Send refund: both trains leave together.`
      : `${a} is not over ${eur(threshold)}, so neither signal will ask. Press Send refund.`;
  }
  if (phase === "running" && decision === null) return "Both trains are moving. Watch the bottom one cross the line before it reaches its signal.";
  if (phase === "waiting") return `Top: the call is paused before issue_refund, nothing has moved. Bottom: issue_refund already ran and ${a} left its vault. Approve or deny?`;
  if (phase === "running") return "Approved: both trains carry on to the reply.";
  if (decision === "deny") return `Top: issue_refund never runs; the model gets {"error": "This tool call is rejected."} and the vault keeps ${a}. Bottom: your denial is recorded, but ${a} is already gone. Undoing it needs a separate reversal.`;
  if (decision === "approve") return `Approved: both tracks pay ${a}. With a yes, placement makes no difference; it only matters when the answer is no.`;
  return `Nobody was asked: both tracks paid ${a}. Raise the refund or lower the threshold to make the signals ask.`;
}

function render() {
  if (!anim) draw();
  els.thv.textContent = threshold === 0 ? "€0 (every refund)" : eur(threshold);
  els.caption.textContent = captionText();
  els.decide.hidden = phase !== "waiting";
  els.send.textContent = phase === "done" ? "Send again" : "Send refund";
  els["t-top"].textContent = eur(START - lanes.top.paid);
  els["t-top"].className = `tv mono${lanes.top.paid ? " neg" : " pos"}`;
  els["t-bottom"].textContent = eur(START - lanes.bottom.paid);
  els["t-bottom"].className = `tv mono${lanes.bottom.paid ? " neg" : " pos"}`;
  els["t-call"].textContent = decision === "deny" ? "Denied" : decision === "approve" ? "Approved" : decision === "auto" ? "Not asked" : phase === "waiting" ? "Waiting for you" : "None yet";
  let verdict = "";
  if (decision === "deny" && prediction) {
    verdict = prediction === "top"
      ? "You predicted the top track: right. Only an approval before the tool can stop the money."
      : `You predicted ${PREDICT[prediction].toLowerCase()}. Only the top track kept the money: its signal stood before the line.`;
  }
  els.verdict.textContent = verdict;
  reportSize();
}

function readProps(props) {
  if (props && AMOUNTS[props.request]) amountKey = props.request;
}

const sim = createSim({
  onInit({ props, theme, reducedMotion }) {
    applyTheme(theme);
    reduced = !!reducedMotion;
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
