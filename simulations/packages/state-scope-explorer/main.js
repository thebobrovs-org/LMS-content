// `createSim` is a global from sim-sdk.js (a classic script loaded first). No imports:
// this bundle runs in an opaque-origin sandbox.
//
// ADK state scopes as a building. The app is the building; each user has an apartment;
// each session is a room in it; the agent works at a desk in the current room. A tool
// writes a sticky note, and the key's prefix decides where the note goes:
//   temp:      -> the desk whiteboard: this invocation only, wiped every turn, never stored
//   no prefix  -> the room wall: this session only
//   user:      -> the apartment fridge: every session of this user, in this app
//   app:       -> the lobby noticeboard: every user and session of this app
// What the agent reads now is lit; the rest goes dark. Restarting the process is a
// separate question, and depends on the session service, not the prefix:
// InMemorySessionService (a tent) loses everything; DatabaseSessionService (brick) keeps
// everything except temp: notes, which were never stored. (ADK state docs; the lesson
// verifies shared user:/app: state on DatabaseSessionService.) Deterministic toy model.

const app = document.getElementById("app");

const APP_NAME = "store-support";
const USERS = ["Ana", "Ben"];
const FIELDS = {
  language: { key: "language", value: '"fr"', label: 'language = "fr"' },
  order: { key: "order_id", value: '"B-77"', label: 'order_id = "B-77"' },
};
const SCOPES = {
  temp: { prefix: "temp:", place: "Desk whiteboard", short: "whiteboard" },
  session: { prefix: "", place: "Room wall", short: "room wall" },
  user: { prefix: "user:", place: "Fridge", short: "fridge" },
  app: { prefix: "app:", place: "Lobby board", short: "lobby board" },
};
const SERVICES = {
  memory: { name: "InMemorySessionService", look: "Tent" },
  database: { name: "DatabaseSessionService", look: "Brick" },
};
const PREDICT = { wall: "The room wall", fridge: "The fridge", both: "Both", neither: "Neither" };

// Layout of the drawing (viewBox 760 x 480).
const APT = { Ana: 32, Ben: 384 };
const APT_Y = 66;
const ROOM = { dx: 108, w: 110, step: 116, y: 100, h: 224 };
const FRIDGE = { dx: 12, w: 84 };
const BOARD = { x: 230, y: 356, w: 300, h: 100 };

let service = "database";
let field = "language";
let nextSession = 1;
let sessions = []; // { id, user, turn, state: { key: value } }
let current = null; // session id
let user = "Ana";
let userState = {}; // user -> { key: value }
let appState = {};
let temp = {}; // this invocation's temp: keys
let wiped = false; // the current desk whiteboard was wiped at the end of the last invocation
let log = [];
let lastWrite = null; // { scope, key } for the note that pops in
let prediction = null;
let reported = false;
let reduced = false;
let shakeTimer = null;
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
  wiped = Object.keys(temp).length > 0;
  temp = {};
}

function resetAll() {
  nextSession = 1;
  sessions = [];
  user = "Ana";
  userState = { Ana: {}, Ben: {} };
  appState = {};
  temp = {};
  wiped = false;
  log = [];
  lastWrite = null;
  newSession(user);
  say(`Ana walks into room ${current}, a new session, on ${SERVICES[service].name}. Pick a note and stick it somewhere.`);
}

function write(scope) {
  const f = FIELDS[field];
  const name = SCOPES[scope].prefix + f.key;
  const s = session();
  if (scope === "session") s.state[f.key] = f.value;
  else if (scope === "user") userState[user][f.key] = f.value;
  else if (scope === "app") appState[f.key] = f.value;
  else temp[f.key] = f.value;
  lastWrite = { scope, key: f.key };
  say(`Turn ${s.turn} of ${s.id}: a tool writes tool_context.state["${name}"] = ${f.value}, a note on the ${SCOPES[scope].short}.`);
  sim.event("state-written", { key: name, service });
}

function nextTurn() {
  endInvocation();
  const s = session();
  s.turn += 1;
  lastWrite = null;
  say(`Next turn: invocation ${s.turn} of ${s.id} starts. ${wiped ? "The desk whiteboard was wiped: temp: keys never outlive a turn." : "The desk whiteboard starts clean, as it does every turn."}`);
}

function openSession(id) {
  endInvocation();
  wiped = false;
  lastWrite = null;
  if (id === "new") {
    newSession(user);
    say(`New session: ${user} walks into a new, empty room ${current}. The fridge and the lobby board are still there.`);
  } else {
    current = id;
    say(`${user} goes back to room ${id}. Its wall notes are where they were left.`);
  }
}

function switchUser(to) {
  endInvocation();
  wiped = false;
  lastWrite = null;
  user = to;
  const mine = sessions.filter((s) => s.user === to);
  if (mine.length) {
    current = mine[mine.length - 1].id;
    say(`The agent now serves ${to}, back in their room ${current}. ${to}'s fridge is lit; the other apartment goes dark.`);
  } else {
    newSession(to);
    say(`The agent now serves ${to}, in a new room ${current}. Only ${to}'s fridge and the lobby board are lit.`);
  }
}

function restart() {
  endInvocation();
  wiped = false;
  lastWrite = null;
  if (service === "memory") {
    sessions = [];
    userState = { Ana: {}, Ben: {} };
    appState = {};
    newSession(user);
    say(`Process restarted. The tent was process memory, so it came down with every room, fridge note and lobby note. ${user} starts again in a new room ${current}.`);
  } else {
    say(`Process restarted. The brick building stands: DatabaseSessionService reloads room ${current}, every fridge and the lobby board. Only temp: notes, never stored, are gone.`);
  }
  shake();
  sim.event("process-restarted", { service });
}

function shake() {
  if (!els.building) return;
  clearTimeout(shakeTimer);
  els.building.classList.remove("shake");
  if (reduced || document.hidden) return;
  // Force the class change to restart the one-off CSS animation.
  void els.building.getBoundingClientRect?.();
  els.building.classList.add("shake");
  shakeTimer = setTimeout(() => els.building.classList.remove("shake"), 700);
}

// The keys the agent's code reads now, merged as session.state shows them.
function readable() {
  const s = session();
  const out = [];
  for (const [k, v] of Object.entries(s.state)) out.push([k, v]);
  for (const [k, v] of Object.entries(userState[user] || {})) out.push([`user:${k}`, v]);
  for (const [k, v] of Object.entries(appState)) out.push([`app:${k}`, v]);
  for (const [k, v] of Object.entries(temp)) out.push([`temp:${k}`, v]);
  return out;
}

function storedCount() {
  let n = 0;
  for (const s of sessions) n += Object.keys(s.state).length;
  for (const u of USERS) n += Object.keys(userState[u] || {}).length;
  return n + Object.keys(appState).length;
}

function insightReady() {
  const hasUserKey = Object.keys(userState[user] || {}).length > 0;
  const hiddenSessionKey = sessions.some((s) => s.user === user && s.id !== current && Object.keys(s.state).length > 0);
  return hasUserKey && hiddenSessionKey;
}

function checkInsight() {
  if (reported || !insightReady()) return;
  reported = true;
  sim.checkpoint("observe-user-scope");
  sim.event("user-scope-observed", { service });
}

// ---- Drawing --------------------------------------------------------------------------------

function note(x, y, w, key, value, cls, isNew) {
  return `<g class="note ${cls}${isNew ? " new" : ""}" transform="translate(${x},${y})">
    <rect width="${w}" height="28" rx="3"/>
    <text class="nk" x="${w / 2}" y="11">${esc(key)}</text>
    <text class="nv" x="${w / 2}" y="23">${esc(value)}</text>
  </g>`;
}

function notes(obj, scope, x, y, w, dy, dx = 0) {
  return Object.entries(obj).map(([k, v], i) => {
    const isNew = !!lastWrite && lastWrite.scope === scope && lastWrite.key === k;
    return note(x + i * dx, y + i * dy, w, k, v, `s-${scope}`, isNew);
  }).join("");
}

// The rooms drawn for one apartment: the last two sessions, always including the current one.
function roomsFor(u) {
  const mine = sessions.filter((s) => s.user === u);
  let shown = mine.slice(-2);
  const cur = mine.find((s) => s.id === current);
  if (cur && !shown.includes(cur)) shown = [cur, ...shown.slice(-1)];
  return { shown, hidden: mine.length - shown.length };
}

function agentAt() {
  const s = session();
  const { shown } = roomsFor(s.user);
  const i = shown.indexOf(s);
  const x = APT[s.user] + ROOM.dx + i * ROOM.step;
  return { x, cx: x + ROOM.w / 2 };
}

function drawApartment(u) {
  const ax = APT[u];
  const mine = u === user;
  const fx = ax + FRIDGE.dx;
  const { shown, hidden } = roomsFor(u);
  const fridgeNotes = notes(userState[u] || {}, mine ? "user" : "user-other", fx + 6, 132, FRIDGE.w - 12, 32);
  const rooms = shown.map((s, i) => {
    const rx = ax + ROOM.dx + i * ROOM.step;
    const here = s.id === current;
    const desk = here
      ? `<g class="desk lit">
          <rect class="wb" x="${rx + 3}" y="212" width="${ROOM.w - 6}" height="106" rx="3"/>
          <text class="pl" x="${rx + ROOM.w / 2}" y="223">desk whiteboard</text>
          <text class="pp" x="${rx + ROOM.w / 2}" y="234">temp:</text>
          ${notes(temp, "temp", rx + 6, 240, ROOM.w - 12, 32)}
          ${wiped && !Object.keys(temp).length ? `<text class="wiped" x="${rx + ROOM.w / 2}" y="272">wiped</text>` : ""}
        </g>
        <g class="agent" transform="translate(${rx + 14},0)"><circle cy="106" r="4.5"/><path d="M-6 117 Q-6 111 0 111 Q6 111 6 117 Z"/></g>`
      : `<text class="pl nobody" x="${rx + ROOM.w / 2}" y="266">nobody here</text>`;
    return `<g class="room${here ? " here" : ""}" data-room="${s.id}">
      <rect class="rm" x="${rx}" y="${ROOM.y}" width="${ROOM.w}" height="${ROOM.h}" rx="4"/>
      <text class="rl" x="${rx + ROOM.w / 2 + (here ? 8 : 0)}" y="${ROOM.y + 14}">${s.id}${here ? " · here" : ""}</text>
      <g class="wall${here ? " lit" : " dim"}">
        <rect class="wl" x="${rx + 3}" y="${ROOM.y + 20}" width="${ROOM.w - 6}" height="86" rx="3"/>
        <text class="pl" x="${rx + ROOM.w / 2}" y="${ROOM.y + 31}">room wall</text>
        <text class="pp" x="${rx + ROOM.w / 2}" y="${ROOM.y + 42}">no prefix</text>
        ${notes(s.state, "session", rx + 6, ROOM.y + 46, ROOM.w - 12, 30)}
      </g>
      ${desk}
    </g>`;
  }).join("");
  const empty = shown.length === 0 ? `<text class="empty" x="${ax + ROOM.dx + 110}" y="210">No sessions yet</text>` : "";
  const more = hidden > 0 ? `<text class="more" x="${ax + 336}" y="${APT_Y + 22}">+${hidden} older ${hidden === 1 ? "room" : "rooms"}</text>` : "";
  return `<g class="apt${mine ? " mine" : " other"}">
    <rect class="ap" x="${ax}" y="${APT_Y}" width="344" height="270" rx="6"/>
    <text class="at" x="${ax + 12}" y="${APT_Y + 22}">${u}'s apartment</text>
    ${more}
    <g class="fridge ${mine ? "lit" : "dim"}">
      <rect class="fb" x="${fx}" y="100" width="${FRIDGE.w}" height="224" rx="6"/>
      <line class="fd" x1="${fx}" y1="196" x2="${fx + FRIDGE.w}" y2="196"/>
      <rect class="fh" x="${fx + FRIDGE.w - 10}" y="206" width="4" height="26" rx="2"/>
      <text class="pl" x="${fx + FRIDGE.w / 2}" y="114">fridge</text>
      <text class="pp" x="${fx + FRIDGE.w / 2}" y="125">user:</text>
      ${fridgeNotes}
    </g>
    ${rooms}${empty}
  </g>`;
}

function drawScene() {
  const tent = service === "memory";
  const roof = tent
    ? `<polygon class="roof" points="20,62 380,10 740,62"/><text class="sign" x="380" y="52">app ${APP_NAME} · a tent (${SERVICES.memory.name})</text>`
    : `<rect class="roof" x="20" y="18" width="720" height="44" rx="4"/><text class="sign" x="380" y="46">app ${APP_NAME} · brick (${SERVICES.database.name})</text>`;
  const lobbyNotes = notes(appState, "app", BOARD.x + 14, BOARD.y + 46, 130, 0, 144);
  els.building.setAttribute("class", `building ${tent ? "tent" : "brick"}`);
  els.building.innerHTML = `
    <rect class="shell" x="20" y="62" width="720" height="410" rx="4"/>
    ${roof}
    ${drawApartment("Ana")}
    ${drawApartment("Ben")}
    <g class="lobby">
      <rect class="lb" x="32" y="344" width="696" height="120" rx="6"/>
      <text class="at" x="44" y="366">Lobby</text>
      <rect class="door" x="60" y="384" width="48" height="80" rx="4"/>
      <circle class="knob" cx="100" cy="426" r="3"/>
      <g class="board lit">
        <rect class="bd" x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.w}" height="${BOARD.h}" rx="4"/>
        <text class="pl" x="${BOARD.x + BOARD.w / 2}" y="${BOARD.y + 16}">lobby noticeboard</text>
        <text class="pp" x="${BOARD.x + BOARD.w / 2}" y="${BOARD.y + 28}">app: · every user</text>
        ${lobbyNotes}
      </g>
    </g>
`;
  const reads = readable().map(([k]) => k);
  els.svg.setAttribute("aria-label", `The agent is in room ${current} of ${user}'s apartment. The light falls on ${user}'s fridge, room ${current}'s wall, the desk whiteboard and the lobby board. It reads ${reads.length ? reads.join(", ") : "nothing yet"}.`);
}

// ---- Controls -------------------------------------------------------------------------------

function build() {
  app.innerHTML = `
    <details class="panel predict" open id="predict">
      <summary class="q"><strong>Predict first.</strong> A tool writes <span class="mono">language = "fr"</span> on the wall and on the fridge (<span class="mono">user:</span>). In Ana's new session, which can the agent read?</summary>
      <div class="chips" role="group" aria-label="Your prediction">
        ${Object.entries(PREDICT).map(([k, v]) => `<button type="button" class="chip" data-predict="${k}" aria-pressed="false">${v}</button>`).join("")}
      </div>
      <p class="verdict" id="verdict"></p>
    </details>
    <div class="panel stage">
      <div class="view">
        <div class="scroll" tabindex="0" role="region" aria-label="The agent's building"><svg id="svg" viewBox="0 0 760 480" role="img"><g id="building"></g></svg></div>
        <section class="merged" aria-labelledby="merged-h">
          <h2 id="merged-h">session.state, as the code reads it</h2>
          <p class="mono" id="merged"></p>
          <p class="readout" id="readout"></p>
        </section>
        <ol class="log" id="log" aria-label="What happened"></ol>
      </div>
      <div class="side">
        <p class="caption" id="caption" role="status"></p>
        <div class="controls">
          <div class="seg" role="group" aria-label="Note a tool writes"><span class="seglabel">Note</span>
            ${Object.entries(FIELDS).map(([k, f]) => `<button type="button" class="pill mono" data-field="${k}" aria-pressed="false">${esc(f.label)}</button>`).join("")}
          </div>
          <div class="seg" role="group" aria-label="Stick it on"><span class="seglabel">Stick it on</span>
            ${Object.entries(SCOPES).map(([k, s]) => `<button type="button" class="put s-${k}" id="put-${k}">${s.place} <span class="mono">${s.prefix || "no prefix"}</span></button>`).join("")}
          </div>
        </div>
        <div class="controls">
          <div class="seg" role="group" aria-label="User"><span class="seglabel">User</span>
            ${USERS.map((u) => `<button type="button" class="pill" data-user="${u}" aria-pressed="false">${u}</button>`).join("")}
          </div>
          <div class="seg"><span class="seglabel">Room</span><span class="seg" id="rooms" role="group" aria-label="Go back to a session"></span>
            <button type="button" id="new-session">New session</button>
            <button type="button" id="turn">Next turn</button>
          </div>
        </div>
        <div class="controls">
          <div class="seg" role="group" aria-label="Session service"><span class="seglabel">Building</span>
            ${Object.entries(SERVICES).map(([k, s]) => `<button type="button" class="pill" data-service="${k}" aria-pressed="false">${s.look} · <span class="mono">${s.name}</span></button>`).join("")}
          </div>
          <div class="buttons">
            <button type="button" id="restart" class="primary">Restart process</button>
            <button type="button" id="reset">Reset</button>
          </div>
        </div>
      </div>
    </div>
    <p class="legend">Notes: amber <span class="mono">temp:</span>, teal no prefix, green <span class="mono">user:</span>, violet <span class="mono">app:</span>; a blue outline marks what the agent reads now. Memory Bank is a separate store: nothing here writes to it.</p>`;
  els = {};
  for (const id of ["svg", "building", "caption", "rooms", "new-session", "turn", "restart", "reset", "merged", "readout", "log", "verdict"]) els[id] = app.querySelector(`#${id}`);
  app.querySelectorAll("[data-predict]").forEach((b) => b.addEventListener("click", () => {
    prediction = b.dataset.predict;
    sim.event("predicted", { prediction });
    render();
  }));
  app.querySelectorAll("[data-field]").forEach((b) => b.addEventListener("click", () => { field = b.dataset.field; render(); }));
  for (const k of Object.keys(SCOPES)) app.querySelector(`#put-${k}`).addEventListener("click", () => { write(k); render(); });
  app.querySelectorAll("[data-user]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.user !== user) switchUser(b.dataset.user);
    render();
  }));
  app.querySelectorAll("[data-service]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.service === service) return;
    service = b.dataset.service;
    resetAll();
    say(`Switched to ${SERVICES[service].look.toLowerCase()}: ${SERVICES[service].name}. The exercise starts again with an empty store: write a note before you restart.`);
    render();
  }));
  els.rooms.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-session]");
    if (b && b.dataset.session !== current) { openSession(b.dataset.session); render(); }
  });
  els.building.addEventListener("click", (e) => {
    const r = e.target.closest?.("[data-room]");
    if (r && r.dataset.room !== current && sessions.find((s) => s.id === r.dataset.room)?.user === user) { openSession(r.dataset.room); render(); }
  });
  els["new-session"].addEventListener("click", () => { openSession("new"); render(); });
  els.turn.addEventListener("click", () => { nextTurn(); render(); });
  els.restart.addEventListener("click", () => { restart(); render(); });
  els.reset.addEventListener("click", () => { resetAll(); render(); });
}

function verdictText() {
  if (!prediction || !reported) return "";
  return prediction === "fridge"
    ? "Right: only the fridge note (user:) followed Ana into the new room. The wall note stayed behind in the old session."
    : "Not quite: only the fridge note (user:) followed Ana into the new room. The wall note (no prefix) belongs to the old session and stays there.";
}

function render() {
  const pressed = (sel, on) => app.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(on(b))));
  pressed("[data-predict]", (b) => b.dataset.predict === prediction);
  pressed("[data-field]", (b) => b.dataset.field === field);
  pressed("[data-user]", (b) => b.dataset.user === user);
  pressed("[data-service]", (b) => b.dataset.service === service);
  // Rebuild the room buttons only when the set changes, so a focused one is never replaced.
  const mine = sessions.filter((s) => s.user === user).map((s) => s.id);
  const key = mine.join(",");
  if (els.rooms.dataset.opts !== key) {
    els.rooms.innerHTML = mine.map((id) => `<button type="button" class="pill" data-session="${id}" aria-pressed="false">${id}</button>`).join("");
    els.rooms.dataset.opts = key;
  }
  pressed("[data-session]", (b) => b.dataset.session === current);

  drawScene();
  lastWrite = null; // a note pops in once, not on every later render
  els.caption.textContent = log[0] || "";
  const merged = readable().map(([k, v]) => `"${k}": ${v}`);
  els.merged.textContent = `{ ${merged.join(", ")} }`;
  const stored = storedCount();
  els.readout.textContent = `${session().id}, turn ${session().turn} · the agent reads ${merged.length} ${merged.length === 1 ? "key" : "keys"} · ${stored} stored ${stored === 1 ? "key" : "keys"} in ${sessions.length} ${sessions.length === 1 ? "room" : "rooms"} · ${SERVICES[service].name}.`;
  els.log.innerHTML = log.slice(1).map((l) => `<li>${esc(l)}</li>`).join("");
  checkInsight();
  els.verdict.textContent = verdictText();
  reportSize();
}

function readProps(props) {
  if (props && SERVICES[props.service]) service = props.service;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && els.building) { clearTimeout(shakeTimer); els.building.classList.remove("shake"); }
});

const sim = createSim({
  onInit({ props, theme, reducedMotion }) {
    applyTheme(theme);
    readProps(props);
    reduced = !!reducedMotion;
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
