// B07: one applicable Finance PAB, storage.objects.get, four private bucket fixtures.
// Verified 2026-11-17: Google Cloud IAM PAB policies, policy types, PAB enforcement
// version permissions (v1 covers object reads), and Cloud Storage IAM roles.
// See PR #197 for dated URLs. No real requests, ACLs, deny policies or extra grants.
const app = document.getElementById("app");
const PICKS = { invoices: "Invoices only", finance: "Both Finance buckets", all: "All four" };
const GRANTS = { none: "No read grants", narrow: "Invoices only", broad: "Organization-wide read" };
const RESOURCES = [
  { id: "invoices", name: "Invoices", project: "Finance", x: 242, y: 50 },
  { id: "exports", name: "Exports", project: "Finance", x: 499, y: 50 },
  { id: "payroll", name: "Payroll", project: "HR", x: 242, y: 230 },
  { id: "backups", name: "Backups", project: "Production", x: 499, y: 230 }
];
let grant = "narrow";
let boundary = true;
let prediction = null;
let sawCappedGrant = false;
let checkpointSent = false;
let mounted = false;
let els = {};

function result(resource) {
  const granted = grant === "broad" || (grant === "narrow" && resource.id === "invoices");
  const eligible = !boundary || resource.project === "Finance";
  return { granted, eligible, allowed: granted && eligible,
    reason: !eligible ? "Outside boundary" : granted ? "Read allowed" : "No read grant" };
}

function door(resource) {
  const r = result(resource);
  const hue = r.allowed ? "allowed" : "denied";
  return `<g transform="translate(${resource.x} ${resource.y})" class="resource ${hue}">
    <rect class="resource-box" width="229" height="135" rx="8"/>
    <text class="k-small" x="14" y="22">${resource.project} bucket</text>
    <text class="resource-title" x="14" y="47">${resource.name}</text>
    <path class="door-frame" d="M175 79V22h35v57"/>
    ${r.allowed ? '<path class="door-leaf" d="M175 22l25-9v76l-25-10z"/><circle class="handle" cx="193" cy="51" r="2"/>' : '<rect class="door-leaf" x="176" y="23" width="33" height="56"/><path class="stop" d="M184 51h17"/>'}
    <circle class="status-dot" cx="20" cy="73" r="8"/>
    ${r.allowed ? '<path class="status-mark" d="M16 73l3 3 5-6"/>' : '<path class="status-mark" d="M16 73h8"/>'}
    <text class="status-text" x="34" y="78">${r.reason}</text>
    <text class="k-small" x="14" y="103">Read grant: ${r.granted ? "yes" : "no"}</text>
    <text class="k-small" x="14" y="120">Eligible: ${r.eligible ? "yes" : "no"}</text>
  </g>`;
}

function drawing() {
  const summary = RESOURCES.map(r => `${r.project} ${r.name}: ${result(r).reason}`).join("; ");
  return `<svg viewBox="0 0 750 390" role="img" aria-label="Invoice agent with ${GRANTS[grant]}; Finance boundary ${boundary ? "on" : "off"}. ${summary}.">
    <rect class="boundary ${boundary ? "on" : "off"}" x="230" y="15" width="508" height="182" rx="14"/>
    <rect class="boundary-label-bg" x="270" y="3" width="430" height="25" rx="4"/>
    <text class="boundary-label" x="280" y="21">${boundary ? "Finance · eligible resources" : "Finance boundary off · all resources eligible"}</text>
    <g class="attempts"><path d="M190 197h19V113h25M209 197v102h25M209 210h279v-97h8M488 210v105h8"/><path d="M228 109l6 4-6 4m0 194l6 4-6 4m256-210l6 4-6 4m-6 198l6 4-6 4"/></g>
    <g transform="translate(12 132)">
      <rect class="agent-box" width="178" height="138" rx="8"/>
      <g class="agent-icon" transform="translate(15 16)"><rect width="34" height="27" rx="8"/><path d="M17 0v-7m-5 22h1m8 0h1M8 27v7h18v-7"/></g>
      <text class="k-title" x="60" y="35">Invoice agent</text>
      <path class="key" d="M30 68a7 7 0 1 0-5 7l10 10 4-4-4-4 3-3z"/>
      <text class="grant-label" x="15" y="112">${grant === "broad" ? "Broad read grant" : grant === "none" ? "No read grants" : "Invoices-only grant"}</text>
    </g>
    ${RESOURCES.map(door).join("")}
    <text class="k-small" x="14" y="296">Same four attempted reads.</text>
    <text class="k-small" x="14" y="312">Policy changes the result.</text>
  </svg>`;
}

function mount() {
  if (mounted) return;
  mounted = true;
  app.innerHTML = `
    <section class="panel predict" aria-labelledby="question">
      <p id="question" class="q"><strong>Predict first.</strong> Add an organization-wide read grant. Which buckets become readable with the Finance boundary on?</p>
      <div class="chips" role="group" aria-label="Your prediction">
        <button class="chip" id="pick-invoices" aria-pressed="false">Invoices only</button>
        <button class="chip" id="pick-finance" aria-pressed="false">Both Finance buckets</button>
        <button class="chip" id="pick-all" aria-pressed="false">All four</button>
      </div>
      <p id="prediction-note" class="note">Choose a prediction to start a fresh comparison, or explore freely.</p>
      <p id="verdict" class="verdict" role="status" aria-live="polite" aria-atomic="true"></p>
    </section>
    <section class="panel stage">
      <div class="scroll" tabindex="0" role="region" aria-label="Resource map: Finance, HR and Production"><div id="map"></div></div>
      <p id="caption" class="caption" role="status" aria-live="polite" aria-atomic="true"></p>
      <div class="controls"><button id="action" class="primary">Add broad read grant</button><button id="reset">Reset</button></div>
      <div class="setting"><span id="grant-label" class="seglabel">Read grant</span><div class="chips" role="group" aria-labelledby="grant-label">
        <button class="chip" id="grant-none" aria-pressed="false">None</button>
        <button class="chip" id="grant-narrow" aria-pressed="true">Invoices only</button>
        <button class="chip" id="grant-broad" aria-pressed="false">Organization-wide</button>
      </div></div>
      <div class="setting"><span id="boundary-label" class="seglabel">Finance boundary</span><div class="chips" role="group" aria-labelledby="boundary-label"><button class="chip" id="boundary-on" aria-pressed="true">On</button><button class="chip" id="boundary-off" aria-pressed="false">Off</button></div></div>
    </section>
    <p id="readout" class="readout"></p>
    <p id="next" class="next"></p>
    <p class="legend">Illustrative private buckets · Object reads only · One applicable boundary. With multiple PABs, eligible resources combine by union: another policy can expand eligibility. Other authorization controls are outside this fixture.</p>`;
  for (const id of ["map", "caption", "action", "reset", "verdict", "prediction-note", "readout", "next"]) els[id] = document.getElementById(id);
  for (const pick of Object.keys(PICKS)) document.getElementById(`pick-${pick}`).addEventListener("click", () => {
    prediction = pick;
    grant = "narrow";
    boundary = true;
    sawCappedGrant = false;
    render();
  });
  for (const key of Object.keys(GRANTS)) document.getElementById(`grant-${key}`).addEventListener("click", () => { grant = key; render(); });
  for (const [id, enabled] of [["on", true], ["off", false]]) document.getElementById(`boundary-${id}`).addEventListener("click", () => { boundary = enabled; render(); });
  els.action.addEventListener("click", () => { grant = grant === "broad" ? "none" : "broad"; render(); });
  els.reset.addEventListener("click", () => {
    grant = "narrow"; boundary = true; prediction = null; sawCappedGrant = false;
    // Keep checkpointSent across Reset: one observation per loaded session.
    render();
  });
}

function reportSize() { requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8)); }

function render() {
  mount();
  const count = RESOURCES.filter(r => result(r).allowed).length;
  els.map.innerHTML = drawing();
  for (const p of Object.keys(PICKS)) document.getElementById(`pick-${p}`).setAttribute("aria-pressed", String(prediction === p));
  for (const g of Object.keys(GRANTS)) document.getElementById(`grant-${g}`).setAttribute("aria-pressed", String(grant === g));
  document.getElementById("boundary-on").setAttribute("aria-pressed", String(boundary));
  document.getElementById("boundary-off").setAttribute("aria-pressed", String(!boundary));
  els.action.textContent = grant === "broad" ? "Remove all grants" : "Add broad read grant";
  els["prediction-note"].textContent = prediction ? `Your prediction: ${PICKS[prediction]}. Choosing a prediction starts a fresh comparison.` : "Choose a prediction to start a fresh comparison, or explore freely.";
  if (prediction && boundary && grant === "broad") sawCappedGrant = true;
  els.verdict.textContent = sawCappedGrant
    ? `You predicted “${PICKS[prediction]}”. ${prediction === "finance" ? "That's right." : "The result was both Finance buckets."} The broad grant adds Exports, but the Finance boundary keeps HR and Production ineligible.`
    : "";
  els.caption.textContent = grant === "none"
    ? `Readable: 0 of 4. ${boundary ? "Finance is still eligible, but a boundary grants nothing. Every read needs a grant." : "Every resource is eligible, but none has a read grant."}`
    : grant === "narrow"
      ? `Readable: 1 of 4. Only Invoices has a read grant. ${boundary ? "Exports is eligible, but eligibility is not permission." : "Turning the boundary off does not add grants."}`
      : boundary
        ? "Readable: 2 of 4. A broad grant opens both Finance buckets. The boundary blocks these object reads to HR and Production."
        : "Readable: 4 of 4. The organization-wide grant reaches every bucket in this fixture when no boundary applies.";
  els.readout.textContent = `Readable: ${count} / 4 buckets`;
  els.next.textContent = grant === "broad" && boundary
    ? "Next: remove every grant. Does the boundary open any door by itself?"
    : grant === "none" && boundary
      ? "Grants give access. A boundary limits where those grants can work."
      : "Try the same broad grant with the Finance boundary on and off.";
  if (!checkpointSent && sawCappedGrant && boundary && grant === "none") {
    checkpointSent = true;
    sim.checkpoint("observe-boundary-caps");
  }
  reportSize();
}

const sim = createSim({ onInit({ theme, reducedMotion }) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  document.documentElement.classList.toggle("reduced", Boolean(reducedMotion));
  render();
} });
setTimeout(() => { if (!sim.isInitialized()) render(); }, 300);
window.addEventListener("resize", reportSize);
