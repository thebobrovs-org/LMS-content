// B05: transport and image-token allocation are independent. Classic script, no requests.
// Sources checked 2026-11-17: ai.google.dev/gemini-api/docs/{file-input-methods,media-resolution}.
// Gemini 3 image budgets: low 280, medium 560, high 1120, ultra_high 2240 per image.
// Four 6 MB photos are illustrative. Bytes below exclude base64/JSON/URI overhead;
// tokens are approximate budgets, not measured usage. Cloud Storage is already registered
// through the Gemini Developer API Files API; it is still fetched for each request.
const app = document.getElementById("app");
const BUDGET = { low: 280, medium: 560, high: 1120, ultra_high: 2240 };
const LABEL = { low: "Low", medium: "Medium", high: "High", ultra_high: "Ultra-high" };
const PICKS = { request: "Request only", tokens: "Token budget only", both: "Both" };
let prediction = null;
let committed = null;
let transport = "inline";
let resolution = "high";
let compared = false;
let checkpointSent = false;
let mounted = false;
let els = {};
const number = (n) => n.toLocaleString("en-US");

// Entirely static end states: neither the host nor CSS reduced-motion preference
// needs a special path to reach the result. No animation/timer runs while idle or hidden.
function applyTheme(theme, reducedMotion) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  document.documentElement.classList.toggle("reduced", Boolean(reducedMotion));
}

function product(i) {
  const drawings = [
    '<path d="M8 31l6-13 10 7 10 4 8 2v8H7z"/><path d="M9 35h31M20 25l4-4m2 7l4-4"/>',
    '<rect x="12" y="12" width="26" height="31" rx="8"/><path d="M20 13V8h10v5"/><rect x="17" y="28" width="16" height="10" rx="3"/>',
    '<path d="M12 15h23v22q-12 8-23 0z"/><path d="M35 18h5q9 9-5 13M10 43h29"/>',
    '<path d="M10 29v-6a15 15 0 0130 0v6"/><rect x="7" y="25" width="9" height="17" rx="4"/><rect x="34" y="25" width="9" height="17" rx="4"/>'
  ];
  return `<g class="product" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${drawings[i]}</g>`;
}

function photos(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">${[0, 1, 2, 3].map((i) =>
    `<g transform="translate(${i * 45} ${i % 2 ? 5 : 0})"><rect class="photo" width="54" height="66" rx="5"/>${product(i)}<path class="fine" d="M9 52h34M9 57h22"/></g>`).join("")}</g>`;
}

function envelope(reference) {
  return reference
    ? `<g transform="translate(43 144)"><rect class="paper reference-envelope" width="132" height="40" rx="4"/><path class="crease" d="M0 0l66 24 66-24"/><g class="tags">${[0, 1, 2, 3].map((i) => `<rect x="${17+i*25}" y="9" width="20" height="12" rx="4"/>`).join("")}</g><text class="small center" x="66" y="58">4 URI references</text></g>`
    : `<g transform="translate(22 96)"><path class="paper" d="M0 30L87-15l87 45v104H0z"/>${photos(0, -6, .88)}<path class="flap" d="M0 47l87 45 87-45v87H0z"/><path class="crease" d="M0 134l58-53m116 53l-58-53"/><text class="small center" x="87" y="119">4 photos · 24 MB</text></g>`;
}

function drawing(reference, baseline = false) {
  const r = baseline ? "high" : resolution;
  const tileCount = { low: 1, medium: 2, high: 4, ultra_high: 8 }[r];
  const description = reference
    ? `Four registered references replace embedded photos in the request. The API still fetches the photos from Cloud Storage. ${LABEL[r]} resolution gives approximately ${number(4 * BUDGET[r])} image tokens.`
    : `Four photos travel inside the request, carrying 24 MB of image bytes before encoding. ${LABEL[r]} resolution gives approximately ${number(4 * BUDGET[r])} image tokens.`;
  return `<svg viewBox="0 0 340 310" role="img" aria-label="${description}">
    ${reference ? `<g transform="translate(27 15)">${photos(5, 0, .6)}<rect class="storage" x="0" y="37" width="126" height="28" rx="5"/><text class="small center" x="63" y="55">Cloud Storage</text></g><path class="fetch" d="M159 56h115q12 0 12 12v64"/><path class="fetch" d="M281 124l5 8 5-8"/><text class="tiny" x="180" y="47">Photos still fetched</text>` : `<text class="small" x="25" y="47">Image data inside each call</text>`}
    ${envelope(reference)}
    <path class="route" d="M203 171h38m-8-6l8 6-8 6"/>
    <circle class="lens" cx="281" cy="168" r="30"/><circle class="glass" cx="277" cy="164" r="12"/><path class="glass" d="M286 173l10 10"/>
    <text class="small center" x="281" y="215">Model reads</text>
    <text class="tiny center" x="281" y="232">${LABEL[r]} detail</text>
    <text class="tiny" x="22" y="246">Embedded image bytes</text>
    <rect class="byte-track" x="22" y="254" width="174" height="14" rx="4"/>
    ${reference ? '<path class="byte-empty" d="M22 254v14"/>' : '<rect class="byte-fill" x="22" y="254" width="174" height="14" rx="4"/>'}
    <text class="small" x="22" y="289">${reference ? "0 MB · references remain" : "24 MB before encoding"}</text>
    <g transform="translate(238 254)">${Array.from({ length: 8 }, (_, i) => `<rect class="token ${i < tileCount ? "filled" : "empty"}" x="${i * 11}" y="0" width="8" height="14" rx="2"/>`).join("")}</g>
    <text class="small center" x="281" y="289">≈ ${number(4 * BUDGET[r])} tokens</text>
  </svg>`;
}

function mount() {
  if (mounted) return;
  mounted = true;
  app.innerHTML = `
    <section class="panel predict" aria-labelledby="predict-question">
      <p id="predict-question" class="q"><strong>Predict first.</strong> Replace the photos with references. What gets smaller?</p>
      <div class="chips" role="group" aria-label="Your prediction">
        <button class="chip" id="pick-request" aria-pressed="false">Request only</button>
        <button class="chip" id="pick-tokens" aria-pressed="false">Token budget only</button>
        <button class="chip" id="pick-both" aria-pressed="false">Both</button>
      </div>
      <p id="prediction-note" class="note">Choose a prediction to start a fresh comparison at High, or explore freely.</p><p id="verdict" class="verdict" role="status"></p>
    </section>
    <section class="panel stage"><div class="scroll" tabindex="0" role="region" aria-label="Inline and reference comparison"><div class="comparison">
      <section class="scene" aria-labelledby="baseline-heading"><h2 id="baseline-heading"><span class="dot">1</span> Inline baseline <span class="badge">HIGH</span></h2><div id="baseline"></div></section>
      <section class="scene experiment" aria-labelledby="experiment-heading"><h2 id="experiment-heading"><span class="dot">2</span> Your request <span id="transport-label" class="badge">INLINE</span></h2><div id="experiment"></div></section>
    </div>
    </div><p id="caption" class="caption" role="status" aria-live="polite" aria-atomic="true"></p>
    <div class="controls"><button id="send" class="primary">Send by reference <span aria-hidden="true">→</span></button><button id="reset" class="reset">Reset</button></div>
    <fieldset id="resolution-controls"><legend>Image reading detail</legend><div class="resolution-row"><div class="chips" role="group" aria-label="Image media resolution"><button class="chip" id="res-low" aria-pressed="false">Low</button><button class="chip" id="res-medium" aria-pressed="false">Medium</button><button class="chip" id="res-high" aria-pressed="true">High</button><button class="chip" id="res-ultra_high" aria-pressed="false">Ultra-high</button></div><span class="note">Per image · Gemini 3</span></div></fieldset></section>
    <div class="readout"><div><span class="metric-label">IMAGE BYTES IN THIS REQUEST</span><strong id="bytes"></strong><span id="byte-note" class="note"></span></div><div><span class="metric-label">APPROXIMATE IMAGE-TOKEN BUDGET</span><strong id="tokens"></strong><span id="token-note" class="note"></span></div></div>
    <p id="detail-note" class="detail-note"></p>
    <p class="legend">Four 6 MB photos are illustrative. Byte counts exclude encoding and request metadata. Budgets are not measured usage. No real model call.</p>
`;
  for (const id of ["baseline", "experiment", "caption", "prediction-note", "transport-label", "send", "reset", "resolution-controls", "bytes", "tokens", "byte-note", "token-note", "detail-note", "verdict"]) els[id] = document.getElementById(id);
  els.baseline.innerHTML = drawing(false, true);
  for (const key of Object.keys(PICKS)) document.getElementById(`pick-${key}`).addEventListener("click", () => {
    prediction = key;
    committed = null;
    transport = "inline";
    resolution = "high";
    compared = false;
    render();
  });
  els.send.addEventListener("click", () => {
    if (prediction && !committed) committed = prediction;
    transport = transport === "inline" ? "reference" : "inline";
    if (transport === "reference" && resolution === "high") compared = true;
    sim.event("compare-media-transport", { transport, resolution });
    render();
  });
  for (const key of Object.keys(BUDGET)) document.getElementById(`res-${key}`).addEventListener("click", () => {
    resolution = key;
    sim.event("change-media-resolution", { resolution });
    render();
  });
  els.reset.addEventListener("click", () => {
    prediction = null;
    committed = null;
    transport = "inline";
    resolution = "high";
    compared = false;
    // The observation latch survives Reset; the host reload starts a new lifetime.
    render();
  });
}

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

function render() {
  mount();
  const reference = transport === "reference";
  const total = 4 * BUDGET[resolution];
  const lower = total < 4480;
  els.experiment.innerHTML = drawing(reference);
  els["transport-label"].textContent = reference ? "REFERENCES" : "INLINE";
  for (const key of Object.keys(PICKS)) {
    const button = document.getElementById(`pick-${key}`);
    button.setAttribute("aria-pressed", String(prediction === key));
  }
  for (const key of Object.keys(BUDGET)) document.getElementById(`res-${key}`).setAttribute("aria-pressed", String(resolution === key));
  els.send.textContent = reference ? "Compare with inline →" : "Send by reference →";
  els["prediction-note"].textContent = prediction
    ? `Your prediction: ${PICKS[prediction]}. Choosing any prediction starts a fresh High comparison.`
    : "Choose a prediction to start a fresh comparison at High, or explore freely.";
  els.verdict.textContent = committed
    ? `${committed === "request" ? "Your prediction was right: only the request shrank." : `You predicted “${PICKS[committed]}”. Only the request shrank.`} The model still receives the same four photos at the same detail when transport changes, so their image-token budget stays the same. Resolution changes that budget.`
    : "";
  const now = reference
    ? (lower ? `Now ${LABEL[resolution]} resolution cuts the image budget to ≈ ${number(total)} tokens. References changed the envelope; resolution changed the reading budget.` : resolution === "high" ? "References remove embedded image bytes. Google still fetches the photos; the image budget stays at ≈ 4,480 tokens. Try Low next." : "Ultra-high increases the image budget to ≈ 8,960 tokens. The request still contains references.")
    : `Inline carries 24 MB of image bytes. The ${LABEL[resolution]} image budget is ≈ ${number(total)} tokens. Send by reference to compare at this same detail.`;
  els.caption.textContent = `${prediction && !committed ? "Prediction saved. " : ""}${now}`;
  els.bytes.textContent = reference ? "0 MB of image bytes" : "24 MB of image bytes";
  els["byte-note"].textContent = reference ? "References + request metadata still travel." : "Before base64 encoding and request metadata.";
  els.tokens.textContent = `≈ ${number(total)} tokens`;
  els["token-note"].textContent = `4 images × ${number(BUDGET[resolution])} · ${total === 4480 ? "unchanged from baseline" : `${total < 4480 ? "−" : "+"}${Math.abs((total / 4480 - 1) * 100)}% vs High`}`;
  els["detail-note"].textContent = lower
    ? "Less detail to work with. Identifying a product may need less detail than reading its tiny serial number. Test the task before choosing Low."
    : "Match detail to the task: identifying a product and reading its tiny serial number can need different resolutions. Higher is not automatically better.";
  if (!checkpointSent && compared && committed && reference && lower) {
    checkpointSent = true;
    sim.checkpoint("observe-reference-vs-resolution");
  }
  reportSize();
}

const sim = createSim({ onInit({ theme, reducedMotion }) { applyTheme(theme, reducedMotion); render(); } });
setTimeout(() => { if (!sim.isInitialized()) render(); }, 300);
window.addEventListener("resize", reportSize);
