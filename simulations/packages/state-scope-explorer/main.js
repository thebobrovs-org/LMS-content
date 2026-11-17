// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// ADK state scopes, one write at a time. A tool writes a value into session state; the
// prefix on the key decides where the session service stores it and who reads it back:
//   no prefix  -> this session only
//   user:      -> every session of this user, in this app
//   app:       -> every user and session of this app
//   temp:      -> this invocation only, never persisted
// Restarting the process is a separate question: it depends on the session service, not
// on the prefix. InMemorySessionService loses everything; DatabaseSessionService keeps
// everything except temp: keys, which were never stored. (ADK state docs; the lesson
// verifies shared user:/app: state on DatabaseSessionService.) Deterministic toy model.

const app = document.getElementById("app");

const APP_NAME = "store-support";
const USERS = ["Ana", "Ben"];
const FIELDS = {
  language: { key: "language", value: '"fr"', label: 'language = "fr" (a reply-language choice)' },
  order: { key: "order_id", value: '"B-77"', label: 'order_id = "B-77" (the order being discussed)' },
};
const SCOPES = {
  session: { prefix: "", label: "No prefix (session)" },
  user: { prefix: "user:", label: "user:" },
  app: { prefix: "app:", label: "app:" },
  temp: { prefix: "temp:", label: "temp:" },
};
const SERVICES = {
  database: "DatabaseSessionService",
  memory: "InMemorySessionService",
};

let service = "database";
let field = "language";
let scope = "session";
let nextSession = 1;
let sessions = []; // { id, user, turn, state: { key: value } }
let current = null; // session id
let user = "Ana";
let userState = {}; // user -> { key: value }
let appState = {};
let temp = {}; // this invocation's temp: keys
let tempGone = []; // { key, value, where } discarded at the end of an invocation
let log = [];
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

function session() {
  return sessions.find((s) => s.id === current);
}

function say(text) {
  log.unshift(text);
  log = log.slice(0, 5);
}

function newSession(forUser) {
  const s = { id: `S-${nextSession++}`, user: forUser, turn: 1, state: {} };
  sessions.push(s);
  current = s.id;
  return s;
}

// The current invocation ends: temp: keys are dropped, never persisted.
function endInvocation() {
  const s = session();
  for (const k of Object.keys(temp)) tempGone.push({ key: k, value: temp[k], where: s ? `invocation ${s.turn} of ${s.id}` : "the last invocation" });
  temp = {};
}

function resetAll() {
  nextSession = 1;
  sessions = [];
  user = "Ana";
  userState = { Ana: {}, Ben: {} };
  appState = {};
  temp = {};
  tempGone = [];
  log = [];
  newSession(user);
  say(`Started session ${current} for user ${user} on ${SERVICES[service]}.`);
}

function write() {
  const f = FIELDS[field];
  const name = SCOPES[scope].prefix + f.key;
  const s = session();
  if (scope === "session") s.state[f.key] = f.value;
  else if (scope === "user") userState[user][f.key] = f.value;
  else if (scope === "app") appState[f.key] = f.value;
  else temp[f.key] = f.value;
  tempGone = tempGone.filter((t) => t.key !== f.key || scope !== "temp");
  say(`Invocation ${s.turn} of ${s.id}: a tool writes tool_context.state["${name}"] = ${f.value}.`);
  sim.event("state-written", { key: name, service });
}

function nextTurn() {
  endInvocation();
  const s = session();
  s.turn += 1;
  say(`Next turn: invocation ${s.turn} of ${s.id} starts. temp: keys from the last one are gone.`);
}

function openSession(id) {
  endInvocation();
  if (id === "new") {
    newSession(user);
    say(`New session ${current} for user ${user}. It starts with an empty history.`);
  } else {
    current = id;
    say(`Resumed session ${id} (user ${user}). Its stored state loads with it.`);
  }
}

function switchUser(to) {
  endInvocation();
  user = to;
  const mine = sessions.filter((s) => s.user === to);
  if (mine.length) {
    current = mine[mine.length - 1].id;
    say(`Switched to user ${to}, resuming their session ${current}.`);
  } else {
    newSession(to);
    say(`Switched to user ${to}: new session ${current}.`);
  }
}

function restart() {
  endInvocation();
  tempGone = [];
  if (service === "memory") {
    sessions = [];
    userState = { Ana: {}, Ben: {} };
    appState = {};
    newSession(user);
    say(`Process restarted. InMemorySessionService kept everything in process memory, so every session and every user: and app: key is gone. Your app starts a new session ${current}.`);
  } else {
    say(`Process restarted. DatabaseSessionService reloads session ${current} and every user: and app: key from the database. Only temp: keys, never stored, are gone.`);
  }
  sim.event("process-restarted", { service });
}

// Every stored key, with whether the agent reads it in the current invocation and why.
function rows() {
  const out = [];
  for (const s of sessions) {
    for (const [k, v] of Object.entries(s.state)) {
      const vis = s.id === current;
      out.push({ key: k, value: v, where: `Session ${s.id} (${s.user})`, vis, why: vis ? "This session" : `Belongs to session ${s.id}` });
    }
  }
  for (const u of USERS) {
    for (const [k, v] of Object.entries(userState[u] || {})) {
      const vis = u === user;
      out.push({ key: `user:${k}`, value: v, where: `User ${u}, all their sessions`, vis, why: vis ? `User ${u}` : `Belongs to user ${u}` });
    }
  }
  for (const [k, v] of Object.entries(appState)) {
    out.push({ key: `app:${k}`, value: v, where: `App ${APP_NAME}, every user`, vis: true, why: "Every user and session" });
  }
  const s = session();
  for (const [k, v] of Object.entries(temp)) {
    out.push({ key: `temp:${k}`, value: v, where: `Invocation ${s.turn} of ${s.id} only`, vis: true, why: "This invocation only" });
  }
  for (const t of tempGone) {
    out.push({ key: `temp:${t.key}`, value: t.value, where: "Not stored", vis: false, gone: true, why: `Discarded when ${t.where} ended` });
  }
  return out;
}

function checkInsight() {
  if (reported) return;
  const hasUserKey = Object.keys(userState[user] || {}).length > 0;
  const hiddenSessionKey = sessions.some((s) => s.user === user && s.id !== current && Object.keys(s.state).length > 0);
  if (hasUserKey && hiddenSessionKey) {
    reported = true;
    sim.checkpoint("observe-user-scope");
    sim.event("user-scope-observed", { service });
  }
}

function sessionOptions() {
  const mine = sessions.filter((s) => s.user === user);
  return mine.map((s) => `<option value="${s.id}">${s.id}</option>`).join("") + '<option value="new">New session</option>';
}

function build() {
  app.innerHTML = `
    <div class="controls">
      <label class="field">Value a tool writes
        <select id="field">
          ${Object.entries(FIELDS).map(([id, f]) => `<option value="${id}">${esc(f.label)}</option>`).join("")}
        </select>
      </label>
      <label class="field">Key prefix
        <select id="scope">
          ${Object.entries(SCOPES).map(([id, s]) => `<option value="${id}">${esc(s.label)}</option>`).join("")}
        </select>
      </label>
      <div class="buttons"><button id="write">Write to state</button></div>
    </div>
    <div class="controls">
      <label class="field">User
        <select id="user">${USERS.map((u) => `<option value="${u}">${u}</option>`).join("")}</select>
      </label>
      <label class="field">Session
        <select id="session"></select>
      </label>
      <label class="field">Session service
        <select id="service">
          <option value="database">DatabaseSessionService</option>
          <option value="memory">InMemorySessionService</option>
        </select>
      </label>
      <div class="buttons">
        <button id="turn" class="secondary">Next turn</button>
        <button id="restart" class="secondary">Restart process</button>
        <button id="reset" class="secondary">Reset</button>
      </div>
    </div>
    <p class="context mono" id="context"></p>
    <section class="store" aria-labelledby="store-h">
      <h2 id="store-h">Stored state, and what the agent reads now</h2>
      <ul id="rows"></ul>
    </section>
    <section class="merged" aria-labelledby="merged-h">
      <h2 id="merged-h">session.state, as the agent's code reads it</h2>
      <p class="mono" id="merged"></p>
    </section>
    <p class="readout" id="readout" role="status"></p>
    <ol class="log" id="log" aria-label="What happened"></ol>
    <p class="legend">A prefix sets scope; the session service sets whether anything survives a restart. Memory Bank is a separate store: nothing here writes to it.</p>`;
  els = {};
  for (const id of ["field", "scope", "write", "user", "session", "service", "turn", "restart", "reset", "context", "rows", "merged", "readout", "log"]) {
    els[id] = app.querySelector(`#${id}`);
  }
  els.field.value = field;
  els.scope.value = scope;
  els.service.value = service;
  els.field.addEventListener("change", () => { field = els.field.value; });
  els.scope.addEventListener("change", () => { scope = els.scope.value; });
  els.write.addEventListener("click", () => { write(); render(); });
  els.user.addEventListener("change", () => { switchUser(els.user.value); render(); });
  els.session.addEventListener("change", () => { openSession(els.session.value); render(); });
  els.service.addEventListener("change", () => {
    service = els.service.value;
    resetAll();
    say(`Switched to ${SERVICES[service]}. The exercise starts again with an empty store: write a value before you restart.`);
    render();
  });
  els.turn.addEventListener("click", () => { nextTurn(); render(); });
  els.restart.addEventListener("click", () => { restart(); render(); });
  els.reset.addEventListener("click", () => { resetAll(); render(); });
}

function render() {
  const s = session();
  els.user.value = user;
  const opts = sessionOptions();
  if (els.session.dataset.opts !== opts) {
    els.session.innerHTML = opts;
    els.session.dataset.opts = opts;
  }
  els.session.value = current;
  els.context.textContent = `app ${APP_NAME} · user ${user} · session ${s.id} · invocation ${s.turn}`;

  const all = rows();
  els.rows.innerHTML = all.length
    ? all.map((r) => `<li class="srow ${r.vis ? "vis" : "hid"}${r.gone ? " gone" : ""}">
        <span class="mono key">${esc(r.key)} = ${esc(r.value)}</span>
        <span class="where">${esc(r.where)}</span>
        <span class="seen">${r.vis ? "✓ Agent reads it" : "✗ Not visible"}<span class="why">${esc(r.why)}</span></span>
      </li>`).join("")
    : `<li class="empty">Nothing stored. Pick a value and a prefix, then Write to state.</li>`;

  const merged = all.filter((r) => r.vis).map((r) => `"${r.key}": ${r.value}`);
  els.merged.textContent = `{ ${merged.join(", ")} }`;

  const stored = all.filter((r) => !r.gone).length;
  els.readout.textContent = `The agent reads ${merged.length} of ${stored} stored ${stored === 1 ? "key" : "keys"} · ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} stored · ${SERVICES[service]}.`;
  els.log.innerHTML = log.map((l) => `<li>${esc(l)}</li>`).join("");
  checkInsight();
  reportSize();
}

function readProps(props) {
  if (props && SERVICES[props.service]) service = props.service;
}

const sim = createSim({
  onInit({ props, theme }) {
    applyTheme(theme);
    readProps(props);
    build();
    resetAll();
    render();
  },
});

// Fallback for opening the bundle directly (no host init).
setTimeout(() => {
  if (!sim.isInitialized() && app.childElementCount === 0) {
    build();
    resetAll();
    render();
  }
}, 300);
