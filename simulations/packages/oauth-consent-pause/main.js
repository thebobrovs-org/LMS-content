// Whose authority: the consent pause (B08). A sequence diagram of one tool call that needs a
// credential, in three flows: three-legged OAuth for Ana's mailbox (ADK pauses with
// adk_request_credential, the client app sends Ana to Google, the code comes back and ADK
// exchanges it), the agent's own service account for its own bucket, and the shortcut of asking
// for the password. The amber credential boundary around the agent and the client app is the
// point: in the right flow a code and a token cross it, never the password.
// Classic script: `createSim` is a global from sim-sdk.js.

const app = document.getElementById("app");

// Columns of the sequence diagram (viewBox units). The agent and the client app sit inside the
// credential boundary, on the left, so the password leg (browser to Google) never crosses it.
const COL = { agent: 62, app: 180, browser: 300, auth: 430, api: 566 };
const W = 640;
const ROW0 = 76;
const DY = 26;
const H = 330;

const FLOWS = {
  user: {
    label: "Ana's mailbox (3LO)",
    api: "Gmail API",
    off: [],
    intro: "Ana asks the agent to draft replies in her Gmail. The draft_reply tool needs her authority, with her consent. Press Next step.",
    steps: [
      { from: "agent", to: "app", text: "adk_request_credential", code: true, caption: "draft_reply needs Ana's mailbox and the session has no token for her, so ADK pauses the run and asks the client app for a credential." },
      { from: "app", to: "browser", text: "open auth_uri", code: true, caption: "The client app adds its redirect URI and sends Ana's browser to Google's consent page. The agent stays paused." },
      { from: "browser", to: "auth", text: "password + consent", kind: "password", caption: "Ana signs in on Google's own page and approves gmail.compose. Her password goes only here, outside the boundary." },
      { from: "auth", to: "browser", text: "redirect_uri?code=…", code: true, caption: "Google sends the browser back to the app's redirect URI with a short-lived, single-use authorisation code. No password, no token." },
      { from: "browser", to: "app", text: "callback URL (code)", caption: "The browser lands on the client app's callback page, and the app captures the full callback URL." },
      { from: "app", to: "agent", text: "FunctionResponse(callback URL)", code: true, caption: "The app answers adk_request_credential with the callback URL, and the paused run resumes." },
      { from: "agent", to: "auth", text: "code + client ID + secret", code: true, caption: "ADK exchanges the code at Google's token endpoint, with the app's client ID and secret. The code is now spent." },
      { from: "auth", to: "agent", text: "access_token: gmail.compose", code: true, kind: "token", caption: "Google returns an access token that acts for Ana, limited to gmail.compose (and possibly a refresh token)." },
      { from: "agent", to: "api", text: "draft_reply + token", code: true, kind: "token", caption: "ADK retries the original draft_reply call automatically, now with Ana's token." },
      { from: "api", to: "agent", text: "draft saved for Ana", kind: "token", caption: "The draft lands in Ana's mailbox only. The agent never saw her password and can do only what she approved." },
    ],
  },
  own: {
    label: "Agent's own bucket",
    api: "Cloud Storage",
    off: ["app", "browser"],
    intro: "The agent writes a report to its own Cloud Storage bucket. Nobody's data but its own is involved. Press Next step.",
    steps: [
      { from: "agent", to: "auth", text: "service-account auth (ADC)", caption: "The agent asks Google for a token as its own service account: a signed JWT, or the metadata server on Cloud Run. ADC picks." },
      { from: "auth", to: "agent", text: "access_token: devstorage.read_write", code: true, kind: "token", caption: "Google returns a token for the service account itself. No user, no browser, no consent step, no pause." },
      { from: "agent", to: "api", text: "write object + token", code: true, kind: "token", caption: "The agent writes the report to its own bucket." },
      { from: "api", to: "agent", text: "201 created", kind: "token", caption: "Right for the agent's own resources. One such credential for every employee's mailbox would be excessive agency." },
    ],
  },
  shortcut: {
    label: "Ask for the password",
    api: "Gmail API",
    off: ["auth", "api"],
    intro: "The shortcut people reach for: Ana gives the agent her password so it can sign in as her. Press Next step.",
    steps: [
      { from: "browser", to: "app", text: "password, typed in chat", kind: "bad", caption: "Ana types her Google password into the chat so the agent can sign in as her." },
      { from: "app", to: "agent", text: "password, in the prompt", kind: "bad", caption: "The client app hands it to the agent. The password is now inside the boundary, and the model has read it." },
      { note: "agent", text: "holds Ana's password", kind: "bad", caption: "The agent holds a credential for everything Ana can do, until she changes it. Three-legged OAuth would give it only gmail.compose." },
    ],
  },
};
const FLOW_ORDER = ["user", "own", "shortcut"];

const PREDICT = [
  { id: "agent", label: "The agent" },
  { id: "app", label: "The client app" },
  { id: "google", label: "Only Google's sign-in page" },
];

const HEADERS = { agent: "ADK agent", app: "Client app", browser: "Ana's browser", auth: "Google OAuth" };

let flow = "user";
let step = 0; // 0: nothing sent yet; n: the first n messages are drawn
let prediction = null;
let checkpointFired = false;
let els = {};

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function reportSize() {
  requestAnimationFrame(() => sim.resize(document.body.scrollHeight + 8));
}

const rowY = (i) => ROW0 + i * DY;

/** One message: a horizontal arrow between two lifelines, its numbered label above it on a backing. */
function message(m, i, now) {
  const y = rowY(i);
  const x1 = COL[m.from];
  const x2 = COL[m.to];
  const dir = x2 > x1 ? 1 : -1;
  const cls = m.kind === "bad" ? "bad" : m.kind === "token" ? "token" : now ? "now" : "past";
  const label = `${i + 1}  ${m.text}`;
  const w = Math.round(label.length * (m.code ? 6.6 : 6.1) + 12);
  const mid = (x1 + x2) / 2;
  const lx = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, mid));
  const pw = m.kind === "password" ? " pw" : "";
  return `<g class="msg ${cls}${pw}${now ? " is-now" : ""}">
    <line x1="${x1 + dir * 5}" y1="${y}" x2="${x2 - dir * 7}" y2="${y}" marker-end="url(#m-${cls})"/>
    <rect class="lbl-bg" x="${lx - w / 2}" y="${y - 18}" width="${w}" height="14" rx="3"/>
    <text x="${lx}" y="${y - 7}" text-anchor="middle" class="lbl${m.code ? " k-code" : ""}">${esc(label)}</text>
  </g>`;
}

/** A note on one lifeline: the shortcut's last step, where the agent is left holding the password. */
function note(m, i) {
  const y = rowY(i);
  const w = Math.round(m.text.length * 6.1 + 34);
  const x = COL[m.note] - 16;
  return `<g class="msg bad is-now"><rect class="note" x="${x}" y="${y - 12}" width="${w}" height="20" rx="10"/>
    <text x="${x + w / 2}" y="${y + 2}" text-anchor="middle" class="lbl note-t">${i + 1}  ${esc(m.text)}</text></g>`;
}

function drawing() {
  const f = FLOWS[flow];
  const breach = flow === "shortcut" && step >= 2;
  const parts = [];
  parts.push(`<defs>${["now", "past", "token", "bad"].map((c) => `<marker id="m-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="mk-${c}"/></marker>`).join("")}</defs>`);
  // The credential boundary: around the agent and the client app.
  parts.push(`<rect class="boundary${breach ? " breached" : ""}" x="5" y="4" width="236" height="${H - 8}" rx="12"/>`);
  parts.push(`<text class="boundary-t${breach ? " breached" : ""}" x="123" y="17" text-anchor="middle">${breach ? "Boundary breached: password inside" : "Credential boundary: no password in here"}</text>`);
  // Lifelines and their headers.
  for (const [id, x] of Object.entries(COL)) {
    const off = f.off.includes(id);
    const name = id === "api" ? f.api : HEADERS[id];
    parts.push(`<line class="life${off ? " off" : ""}" x1="${x}" y1="52" x2="${x}" y2="${H - 10}"/>`);
    parts.push(`<rect class="head ${id}${off ? " off" : ""}" x="${x - 52}" y="26" width="104" height="24" rx="8"/>`);
    parts.push(`<text class="head-t${off ? " off" : ""}" x="${x}" y="42" text-anchor="middle">${esc(name)}</text>`);
    if (off) parts.push(`<text class="k-small" x="${x}" y="66" text-anchor="middle">not involved</text>`);
  }
  // ADK's pause: from the credential request until the callback comes back.
  if (flow === "user" && step >= 1) {
    const end = step >= 6 ? rowY(5) : rowY(Math.max(step, 1) - 1) + DY - 6;
    parts.push(`<line class="paused-line" x1="${COL.agent}" y1="${rowY(0) + 4}" x2="${COL.agent}" y2="${end}"/>`);
    const was = step >= 6;
    parts.push(`<rect class="paused${was ? " was" : ""}" x="${COL.agent - 36}" y="${rowY(2) - 11}" width="72" height="20" rx="10"/><text class="paused-t${was ? " was" : ""}" x="${COL.agent}" y="${rowY(2) + 3}" text-anchor="middle">${was ? "resumed" : "paused"}</text>`);
  }
  f.steps.slice(0, step).forEach((m, i) => parts.push(m.note ? note(m, i) : message(m, i, i === step - 1)));
  return parts.join("");
}

/** Who holds the password, the code and the token right now. */
function holdings() {
  if (flow === "user") {
    return [
      ["Password", step >= 3 ? "Google's sign-in page only" : "nobody yet", step >= 3 ? "ok" : ""],
      ["Code", step < 4 ? "none yet" : step === 4 ? "Ana's browser" : step === 5 ? "client app" : step === 6 ? "agent" : "spent at Google", ""],
      ["Token", step >= 8 ? "agent: gmail.compose, for Ana" : "none yet", step >= 8 ? "ok" : ""],
    ];
  }
  if (flow === "own") {
    return [
      ["Password", "none: no user involved", ""],
      ["Code", "none: no consent step", ""],
      ["Token", step >= 2 ? "agent: its own bucket only" : "none yet", step >= 2 ? "ok" : ""],
    ];
  }
  return [
    ["Password", step === 0 ? "Ana only" : step === 1 ? "client app" : "client app, agent, the model", step >= 1 ? "bad" : ""],
    ["Code", "none", ""],
    ["Token", "none: the agent has the password itself", step >= 3 ? "bad" : ""],
  ];
}

function verdict() {
  if (!prediction || flow !== "user" || step < 3) return "";
  const pick = PREDICT.find((p) => p.id === prediction).label;
  if (prediction === "google") return `You picked: ${pick}. Right: Ana types it on Google's own page; the app and the agent only ever see a code and a token.`;
  return `You picked: ${pick}. Not so: the password went from Ana's browser straight to Google, outside the boundary. The ${prediction === "agent" ? "agent" : "client app"} sees only a code and a token.`;
}

function caption() {
  const f = FLOWS[flow];
  return step === 0 ? f.intro : f.steps[step - 1].caption;
}

function build() {
  app.innerHTML = `
    <details class="panel predict" open>
      <summary class="q"><strong>Predict first.</strong> Ana asks the agent to draft replies in her Gmail. Who sees her Google password?</summary>
      <div class="chips" role="group" aria-label="Your prediction">${PREDICT.map((p) => `<button type="button" class="chip" data-predict="${p.id}" aria-pressed="false">${esc(p.label)}</button>`).join("")}</div>
      <p class="verdict" id="verdict" role="status"></p>
    </details>
    <div class="panel stage">
      <div class="scroll" tabindex="0" role="region" aria-label="The messages of one tool call"><svg id="svg" viewBox="0 0 ${W} ${H}" role="img"></svg></div>
      <div class="side">
        <p class="caption" id="caption" role="status"></p>
        <div class="controls">
          <div class="seg" role="group" aria-label="Flow"><span class="seglabel">Flow</span>${FLOW_ORDER.map((id) => `<button type="button" class="chip" data-flow="${id}" aria-pressed="false">${esc(FLOWS[id].label)}</button>`).join("")}</div>
          <div class="buttons"><button type="button" class="primary" id="step">Next step</button><button type="button" id="back">Back</button><button type="button" id="reset">Reset</button></div>
        </div>
        <ul class="holds" id="holds" aria-label="Who holds what"></ul>
      </div>
    </div>
    <p class="legend">Blue: the message just sent. Green: a token and what it buys. Red: the password where it should never be. Amber dashed: the credential boundary. Ana and her mailbox are fictional.</p>`;
  els = {
    svg: app.querySelector("#svg"),
    caption: app.querySelector("#caption"),
    verdict: app.querySelector("#verdict"),
    holds: app.querySelector("#holds"),
    step: app.querySelector("#step"),
  };
  app.querySelectorAll("[data-predict]").forEach((b) => b.addEventListener("click", () => {
    prediction = b.dataset.predict;
    sim.event("predicted", { prediction });
    render();
  }));
  app.querySelectorAll("[data-flow]").forEach((b) => b.addEventListener("click", () => {
    if (flow === b.dataset.flow) return;
    flow = b.dataset.flow;
    step = 0;
    sim.event("flow", { flow });
    render();
  }));
  els.step.addEventListener("click", () => {
    if (step >= FLOWS[flow].steps.length) return;
    step += 1;
    sim.event("step", { flow, step });
    if (flow === "user" && step === FLOWS.user.steps.length && !checkpointFired) {
      checkpointFired = true;
      sim.checkpoint("observe-consent-pause");
    }
    render();
  });
  app.querySelector("#back").addEventListener("click", () => {
    if (step === 0) return;
    step -= 1;
    render();
  });
  app.querySelector("#reset").addEventListener("click", () => {
    flow = "user";
    step = 0;
    prediction = null;
    render();
  });
}

function render() {
  const f = FLOWS[flow];
  els.svg.innerHTML = drawing();
  els.svg.setAttribute("aria-label", `Sequence of messages, ${f.label}, step ${step} of ${f.steps.length}. ${caption()}`);
  els.caption.textContent = caption();
  els.verdict.textContent = verdict();
  els.holds.innerHTML = holdings().map(([k, v, c]) => `<li class="${c}"><span class="hk">${k}</span><span class="hv">${esc(v)}</span></li>`).join("");
  els.step.textContent = step >= f.steps.length ? "Done" : "Next step";
  app.querySelectorAll("[data-predict]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.predict === prediction)));
  app.querySelectorAll("[data-flow]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.flow === flow)));
  reportSize();
}

const sim = createSim({
  onInit({ props, theme, reducedMotion }) {
    applyTheme(theme);
    document.documentElement.classList.toggle("reduced", Boolean(reducedMotion));
    flow = props && FLOWS[props.flow] ? props.flow : "user";
    step = 0;
    prediction = null;
    build();
    render();
  },
});

// Opened without a host: render with the defaults.
setTimeout(() => {
  if (!sim.isInitialized() && app.childElementCount === 0) {
    build();
    render();
  }
}, 300);
