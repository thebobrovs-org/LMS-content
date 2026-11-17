// createSim is a global from sim-sdk.js (classic script). Deploy a TPU job on a
// capacity mode and watch the cost/outcome play out: Spot gets preempted and
// restarts (wasting progress), Calendar bills for the reserved window whether you
// use it or not, Flex Start queues then runs clean. Compare total cost in the run
// history. Deterministic core (fixed-point preemption), theme-aware, no CDNs.

// Illustrative relative costs — not real pricing.
const SLICE_CONFIG = {
  v6e: { chips: 256, baseCostHour: 300 },
  v5p: { chips: 1024, baseCostHour: 1500 },
};

const MODE_CONFIG = {
  dws: { label: "DWS · Flex Start", multiplier: 0.47, queueTicks: 40, speed: 0.7, preemptAt: [] },
  calendar: { label: "DWS · Calendar", multiplier: 0.7, queueTicks: 20, speed: 0.7, preemptAt: [] },
  spot: { label: "Spot", multiplier: 0.25, queueTicks: 0, speed: 0.7, preemptAt: [42, 68] },
  ondemand: { label: "On-demand", multiplier: 1.0, queueTicks: 0, speed: 0.7, preemptAt: [] },
};

const REDUCE =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let state = { slice: "v6e", mode: "dws", status: "IDLE", progress: 0, cost: 0, queueWait: 0, preemptions: 0, timer: null };
let runHistory = [];
let observed = false;
let reservationDate = "";

const $ = (id) => document.getElementById(id);
const trackBar = $("track-bar"), trackText = $("track-text"), trackBox = $("track-container");
const statCost = $("stat-cost"), statProg = $("stat-prog"), logView = $("log-view");
const historyList = $("history-list"), btnDeploy = $("btn-deploy"), btnStop = $("btn-stop");
const calInput = $("cal-input"), calDate = $("cal-date-display");

function reportSize() { requestAnimationFrame(() => { if (window.sim) sim.resize(document.body.scrollHeight + 8); }); }
function applyTheme(t) {
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

function futureDateLabel() {
  const d = new Date();
  d.setDate(d.getDate() + 3); // deterministic +3-day lead
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · 00:00 UTC";
}

function log(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `log-line ${type}`;
  el.textContent = msg;
  logView.appendChild(el);
  logView.scrollTop = logView.scrollHeight;
}

document.querySelectorAll("#slice-btns .opt-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    if (state.status !== "IDLE") return;
    document.querySelectorAll("#slice-btns .opt-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.slice = btn.dataset.slice;
  }),
);
document.querySelectorAll("#mode-btns .opt-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    if (state.status !== "IDLE") return;
    document.querySelectorAll("#mode-btns .opt-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.mode = btn.dataset.mode;
    if (state.mode === "calendar") {
      reservationDate = futureDateLabel();
      calDate.textContent = reservationDate;
      calInput.classList.add("active");
    } else calInput.classList.remove("active");
  }),
);
btnDeploy.addEventListener("click", startJob);
btnStop.addEventListener("click", stopJob);

function updateUI() {
  statCost.textContent = `$${state.cost.toFixed(2)}`;
  statProg.textContent = `${state.progress.toFixed(1)}%`;
  if (state.status === "IDLE") {
    trackBar.style.width = "0%";
    trackBar.className = "track-fill";
    trackText.textContent = "Idle — awaiting submission";
    btnDeploy.style.display = "flex";
    btnStop.style.display = "none";
  } else if (state.status === "QUEUED") {
    trackBar.style.width = "100%";
    if (state.mode === "calendar") {
      trackBar.className = "track-fill scheduled";
      trackText.textContent = "Reserved window active — billing the whole block (job spinning up)";
    } else {
      trackBar.className = "track-fill queued";
      trackText.textContent = "Kueue: waiting for free capacity…";
    }
  } else if (state.status === "RUNNING") {
    trackBar.style.width = `${state.progress}%`;
    trackBar.className = "track-fill";
    trackText.textContent = `Training: ${state.slice} (${MODE_CONFIG[state.mode].label})`;
  }
}

function renderHistory() {
  if (runHistory.length === 0) return;
  let html = `<div class="h-row header"><div>Mode</div><div>Chips</div><div>Progress</div><div>Cost</div><div style="text-align:right">Status</div></div>`;
  runHistory.forEach((r) => {
    html += `<div class="h-row"><div style="font-weight:600">${r.mode}</div><div class="muted">${r.slice}</div><div>${r.prog}</div><div class="h-col cost">${r.cost}</div><div style="text-align:right"><span class="h-col badge ${r.cls}">${r.status}</span></div></div>`;
  });
  historyList.innerHTML = html;
  reportSize();
}
function addHistory(statusLabel, badgeClass) {
  const prog = state.preemptions > 0 ? `${state.progress.toFixed(0)}% · ${state.preemptions} kill${state.preemptions > 1 ? "s" : ""}` : `${state.progress.toFixed(0)}%`;
  runHistory.unshift({ mode: MODE_CONFIG[state.mode].label, slice: SLICE_CONFIG[state.slice].chips, prog, cost: "$" + state.cost.toFixed(2), status: statusLabel, cls: badgeClass });
  if (runHistory.length > 5) runHistory.pop();
  renderHistory();
}

// Deploy and Abort take each other's place. When the one a keyboard user pressed is hidden, the other takes focus,
// so focus never falls to the page (LMS-content#135). Which had focus is read before anything is hidden: a hidden
// button loses focus as soon as the browser next updates styles.
const hasFocus = (btn) => document.activeElement === btn;

function startJob() {
  if (state.status !== "IDLE") return;
  const fromDeploy = hasFocus(btnDeploy);
  state.progress = 0; state.cost = 0; state.preemptions = 0;
  state.queueWait = MODE_CONFIG[state.mode].queueTicks;
  state.status = state.queueWait > 0 ? "QUEUED" : "RUNNING";
  btnDeploy.style.display = "none";
  btnStop.style.display = "block";
  logView.innerHTML = "";
  log("xpk workload create — submitting…", "info");
  log(`Target: ${SLICE_CONFIG[state.slice].chips} chips via ${MODE_CONFIG[state.mode].label}`, "info");
  if (state.status === "QUEUED") {
    if (state.mode === "calendar") {
      log(`Reservation confirmed for ${reservationDate}.`, "success");
      log("Billing the full reserved window — paid whether or not the job is using it.", "warn");
    } else {
      log("Submitted to Kueue. Awaiting DWS Flex-start allocation…", "warn");
    }
  }
  state.timer = setInterval(tick, 50);
  updateUI();
  if (fromDeploy) btnStop.focus();
  if (!observed && window.sim) { observed = true; sim.checkpoint("observe-capacity"); }
}

function stopJob() {
  const fromStop = hasFocus(btnStop);
  clearInterval(state.timer);
  addHistory("Aborted", "bg-danger");
  state.status = "IDLE";
  log("Run aborted by user.", "warn");
  updateUI();
  if (fromStop) btnDeploy.focus();
}

function triggerPreemption() {
  if (!REDUCE) {
    trackBox.classList.add("preempt");
    setTimeout(() => trackBox.classList.remove("preempt"), 450);
  }
  log("Preemption signal from GKE — Spot capacity reclaimed.", "err");
  log("Node terminated; unsaved progress lost.", "err");
  trackBar.className = "track-fill preempted";
  trackText.textContent = "Preempted — node terminated";
  state.progress = 0;
  state.status = "QUEUED";
  state.queueWait = 10;
  state.preemptions++;
  log("JobSet auto-restarting from the last checkpoint…", "warn");
}

function tick() {
  const fromStop = hasFocus(btnStop);
  const config = MODE_CONFIG[state.mode];
  const slice = SLICE_CONFIG[state.slice];
  const costPerTick = (slice.baseCostHour / 3600) * config.multiplier * 0.5;

  if (state.status === "QUEUED") {
    state.queueWait--;
    if (state.mode === "calendar") state.cost += costPerTick; // paying for the reserved window
    if (state.queueWait <= 0) {
      state.status = "RUNNING";
      if (state.mode === "calendar") log("Training started on the reserved nodes.", "success");
      else { log("Capacity granted — GKE nodes provisioning.", "success"); log("Multi-host rendezvous OK. Training started.", "success"); }
    }
  } else if (state.status === "RUNNING") {
    const thr = config.preemptAt;
    if (state.preemptions < thr.length && state.progress >= thr[state.preemptions]) {
      state.cost += costPerTick;
      triggerPreemption();
      updateUI();
      return;
    }
    state.cost += costPerTick;
    state.progress += config.speed;
    if (state.progress >= 100) {
      state.progress = 100;
      state.status = "IDLE";
      clearInterval(state.timer);
      log("Training completed.", "success");
      log(`Total spend: $${state.cost.toFixed(2)}`, "info");
      addHistory("Completed", "bg-success");
    }
  }
  updateUI();
  if (state.status === "IDLE" && fromStop) btnDeploy.focus(); // the run finished while Abort had focus
}

window.sim = typeof createSim !== "undefined"
  ? createSim({ onInit({ theme }) { applyTheme(theme); updateUI(); reportSize(); } })
  : null;
if (!window.sim) { updateUI(); }
setTimeout(() => { updateUI(); reportSize(); }, 300);
