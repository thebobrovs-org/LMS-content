// `createSim` is a global from sim-sdk.js (a classic script loaded first).
// Matching follows ADK's TrajectoryEvaluator: a call matches when its name and
// arguments are equal; EXACT needs the same calls in the same order and nothing
// else; IN_ORDER needs the expected calls as a subsequence; ANY_ORDER needs each
// expected call somewhere, each actual call used once. Extra calls are allowed
// by IN_ORDER and ANY_ORDER.
const app = document.getElementById("app");
const readout = document.getElementById("readout");

const CALLS = {
  order: { name: "get_order", args: 'order_id="1182"' },
  policy: { name: "check_policy", args: 'order_id="1182"' },
  refund: { name: "issue_refund", args: 'order_id="1182", amount=60' },
  refundBig: { name: "issue_refund", args: 'order_id="1182", amount=600' },
  faq: { name: "search_faq", args: 'query="refund"' },
};
const EXPECTED = ["order", "policy", "refund"];
const PRESETS = [
  { id: "same", label: "As expected", calls: ["order", "policy", "refund"] },
  { id: "extra", label: "Extra lookup", calls: ["order", "faq", "policy", "refund"] },
  { id: "swap", label: "Harmless swap", calls: ["policy", "order", "refund"] },
  { id: "early", label: "Refund first", calls: ["refund", "order", "policy"] },
  { id: "missing", label: "Skipped check", calls: ["order", "refund"] },
  { id: "amount", label: "Wrong amount", calls: ["order", "policy", "refundBig"] },
];
const ADDABLE = ["order", "policy", "refund", "refundBig", "faq"];

let actual = [];
let preset = "same";
let addChoice = "faq";
let seenInsight = false;

function same(a, b) {
  return CALLS[a].name === CALLS[b].name && CALLS[a].args === CALLS[b].args;
}

function exact(act, exp) {
  if (act.length !== exp.length) {
    return { pass: false, why: act.length > exp.length ? "An extra call is not allowed." : "An expected call is missing." };
  }
  for (let i = 0; i < exp.length; i++) {
    if (!same(act[i], exp[i])) {
      return { pass: false, why: `Call ${i + 1} is ${CALLS[act[i]].name}(${CALLS[act[i]].args}), not ${CALLS[exp[i]].name}(${CALLS[exp[i]].args}).` };
    }
  }
  return { pass: true, why: "Same calls, same arguments, same order, nothing else." };
}

function inOrder(act, exp) {
  let j = 0;
  for (const a of act) if (j < exp.length && same(a, exp[j])) j++;
  if (j === exp.length) {
    return { pass: true, why: act.length > exp.length ? "Every expected call appears in order; extra calls are allowed." : "Every expected call appears in order." };
  }
  const missing = `${CALLS[exp[j]].name}(${CALLS[exp[j]].args})`;
  if (j === 0 || !act.some((a) => same(a, exp[j]))) return { pass: false, why: `${missing} never appears.` };
  return { pass: false, why: `${missing} appears only before the earlier expected calls.` };
}

function anyOrder(act, exp) {
  const pool = act.slice();
  for (const e of exp) {
    const i = pool.findIndex((a) => same(a, e));
    if (i < 0) return { pass: false, why: `${CALLS[e].name}(${CALLS[e].args}) is missing.` };
    pool.splice(i, 1);
  }
  return { pass: true, why: act.length > exp.length ? "Every expected call appears; order and extra calls are ignored." : "Every expected call appears; order is ignored." };
}

function evaluate() {
  return [
    { mode: "EXACT", ...exact(actual, EXPECTED) },
    { mode: "IN_ORDER", ...inOrder(actual, EXPECTED) },
    { mode: "ANY_ORDER", ...anyOrder(actual, EXPECTED) },
  ];
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function callText(key) {
  return `${CALLS[key].name}(${CALLS[key].args})`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function render() {
  const focusKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.focus : null;
  const results = evaluate();
  const passing = results.filter((r) => r.pass).length;

  const expectedRows = EXPECTED.map((k, i) => `<li><span class="num">${i + 1}</span><span class="call">${escapeHtml(callText(k))}</span></li>`).join("");
  const actualRows = actual.length
    ? actual
        .map(
          (k, i) => `<li><span class="num">${i + 1}</span><span class="call">${escapeHtml(callText(k))}</span>
            <span class="row-actions">
              <button type="button" data-act="up" data-i="${i}" data-focus="up-${i}" aria-label="Move call ${i + 1} up" ${i === 0 ? "disabled" : ""}>Up</button>
              <button type="button" data-act="down" data-i="${i}" data-focus="down-${i}" aria-label="Move call ${i + 1} down" ${i === actual.length - 1 ? "disabled" : ""}>Down</button>
              <button type="button" data-act="remove" data-i="${i}" data-focus="remove-${i}" aria-label="Remove call ${i + 1}">Remove</button>
            </span></li>`,
        )
        .join("")
    : `<li class="empty">No tool calls.</li>`;

  const modes = results
    .map(
      (r) => `<div class="mode ${r.pass ? "pass" : "fail"}">
        <h3>${r.mode}</h3>
        <p class="verdict">${r.pass ? "Pass, score 1.0" : "Fail, score 0.0"}</p>
        <p class="why">${escapeHtml(r.why)}</p>
      </div>`,
    )
    .join("");

  const presetButtons = PRESETS.map(
    (p) => `<button type="button" data-preset="${p.id}" data-focus="preset-${p.id}" aria-pressed="${preset === p.id}">${p.label}</button>`,
  ).join("");
  const options = ADDABLE.map((k) => `<option value="${k}" ${k === addChoice ? "selected" : ""}>${escapeHtml(callText(k))}</option>`).join("");

  app.innerHTML = `
    <p class="label" id="presets-label">Try a run</p>
    <div class="presets" role="group" aria-labelledby="presets-label">${presetButtons}</div>
    <div class="lanes">
      <section class="lane" aria-labelledby="exp-h">
        <p class="label" id="exp-h">Expected trajectory</p>
        <ol>${expectedRows}</ol>
      </section>
      <section class="lane" aria-labelledby="act-h">
        <p class="label" id="act-h">Actual run (edit it)</p>
        <ol>${actualRows}</ol>
      </section>
    </div>
    <div class="add">
      <select id="add-call" data-focus="add-select" aria-label="Tool call to add">${options}</select>
      <button type="button" id="add" data-focus="add" class="primary">Add call</button>
      <button type="button" id="reset" data-focus="reset">Reset</button>
    </div>
    <div class="modes">${modes}</div>
    <div class="legend">By default, a call matches only with the same name and arguments. EXACT allows nothing extra; IN_ORDER allows extra calls between; ANY_ORDER also ignores order.</div>`;

  app.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      preset = b.dataset.preset;
      actual = PRESETS.find((p) => p.id === preset).calls.slice();
      changed("preset");
    }),
  );
  app.querySelectorAll("[data-act]").forEach((b) =>
    b.addEventListener("click", () => {
      const i = Number(b.dataset.i);
      const act = b.dataset.act;
      if (act === "up" && i > 0) [actual[i - 1], actual[i]] = [actual[i], actual[i - 1]];
      if (act === "down" && i < actual.length - 1) [actual[i + 1], actual[i]] = [actual[i], actual[i + 1]];
      if (act === "remove") actual.splice(i, 1);
      preset = null;
      changed(act, act === "up" ? `up-${Math.max(i - 1, 0)}` : act === "down" ? `down-${Math.min(i + 1, actual.length - 1)}` : null);
    }),
  );
  const select = app.querySelector("#add-call");
  select.addEventListener("change", () => {
    addChoice = select.value;
  });
  app.querySelector("#add").addEventListener("click", () => {
    actual.push(addChoice);
    preset = null;
    changed("add");
  });
  app.querySelector("#reset").addEventListener("click", () => {
    reset();
    render();
  });

  const names = results.filter((r) => r.pass).map((r) => r.mode);
  readout.textContent = passing
    ? `${passing} of 3 match modes pass this run: ${names.join(", ")}.`
    : "0 of 3 match modes pass this run.";
  restoreFocus(focusKey);
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

let pendingFocus = null;
function restoreFocus(previous) {
  const key = pendingFocus || previous;
  pendingFocus = null;
  if (!key) return;
  let el = app.querySelector(`[data-focus="${key}"]`);
  if (!el || el.disabled) {
    // A row control that moved or vanished: fall back to the nearest live one, then Add.
    // Up or Down at an end of the list moves to the row's other arrow, never to
    // Remove, so repeated Enter presses cannot delete a call.
    const m = /^(up|down|remove)-(\d+)$/.exec(key);
    if (m && actual.length) {
      const i = Math.min(Number(m[2]), actual.length - 1);
      const order = m[1] === "remove" ? ["remove", "up", "down"] : m[1] === "up" ? ["down"] : ["up"];
      el = null;
      for (const k of order) {
        const c = app.querySelector(`[data-focus="${k}-${i}"]`);
        if (c && !c.disabled) { el = c; break; }
      }
    }
    if (!el) el = app.querySelector('[data-focus="add"]');
  }
  el.focus();
}

function changed(kind, focusKey) {
  if (focusKey) pendingFocus = focusKey;
  const results = evaluate();
  const anyPass = results[2].pass;
  const inOrderPass = results[1].pass;
  // The insight: a reorder that ANY_ORDER accepts and IN_ORDER rejects.
  if (!seenInsight && anyPass && !inOrderPass) {
    seenInsight = true;
    sim.checkpoint("observe-order-sensitivity");
  }
  sim.event("trajectory-changed", { kind, calls: actual.map((k) => CALLS[k].name), pass: results.map((r) => r.pass) });
  render();
}

function reset() {
  actual = EXPECTED.slice();
  preset = "same";
  addChoice = "faq";
}

const sim = createSim({
  onInit({ theme }) {
    applyTheme(theme);
    reset();
    render();
  },
});

setTimeout(() => {
  if (!sim.isInitialized()) {
    reset();
    render();
  }
}, 300);
