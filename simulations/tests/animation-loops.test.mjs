// LMS-content#58: the canvas sims draw only while they're visible (tab shown, sim on
// screen) and something is moving. Auto-motion rests 10 s after the last interaction,
// and under reduced motion there's none, so an idle page costs no CPU. Each real
// main.js runs in a Node vm with a stub DOM, a fake requestAnimationFrame queue, a fake
// clock with timers, and a controllable IntersectionObserver. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages");
const FRAME_MS = 16;

/** A stand-in for any DOM or canvas object: every property is another stub, every call returns one, and it reads as 0. */
function stub() {
  return new Proxy(function () {}, {
    get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : key === "then" ? undefined : stub()),
    set: () => true,
    apply: () => stub(),
    construct: () => stub(),
  });
}

/** Load a sim's main.js with fakes the test controls. */
function loadSim(id, { reducedMotion = false } = {}) {
  const frames = []; // queued requestAnimationFrame callbacks
  const timers = new Map(); // setTimeout id → { at, fn }
  const observers = []; // IntersectionObserver callbacks
  const listeners = {}; // document and window listeners, by event type
  const state = { visibility: "visible", now: 0, nextTimer: 1 };
  const on = (type, fn) => (listeners[type] ??= []).push(fn);
  const document = new Proxy({}, {
    get: (_, key) => (key === "visibilityState" ? state.visibility : key === "addEventListener" ? on : stub()),
  });
  const g = {
    document,
    console,
    performance: { now: () => state.now },
    requestAnimationFrame: (cb) => frames.push(cb),
    cancelAnimationFrame: () => {},
    setTimeout: (fn, ms = 0) => { const t = state.nextTimer++; timers.set(t, { at: state.now + ms, fn }); return t; },
    clearTimeout: (t) => timers.delete(t),
    matchMedia: () => ({ matches: reducedMotion }),
    devicePixelRatio: 1,
    addEventListener: on,
    IntersectionObserver: class {
      constructor(cb) { observers.push(cb); }
      observe() {}
      disconnect() {}
    },
    createSim: () => ({ checkpoint() {}, event() {}, resize() {}, isInitialized: () => true }),
  };
  g.window = g;
  const context = vm.createContext(g);
  const file = path.join(PACKAGES, id, "main.js");
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return {
    run: (code) => vm.runInContext(code, context),
    /**
     * Let `n` frame intervals of FRAME_MS pass, like a browser would: the clock advances,
     * due timers fire, then queued frames run. Returns how many frame callbacks ran.
     */
    pump(n = 1) {
      let ran = 0;
      for (let k = 0; k < n; k++) {
        state.now += FRAME_MS;
        for (const [t, { at, fn }] of [...timers]) if (at <= state.now) { timers.delete(t); fn(); }
        for (const cb of frames.splice(0)) { cb(state.now); ran++; }
      }
      return ran;
    },
    pending: () => frames.length,
    /** How many document/window listeners are registered for an event type. */
    listenerCount: (type) => (listeners[type] ?? []).length,
    setVisible(visible) {
      state.visibility = visible ? "visible" : "hidden";
      for (const fn of listeners.visibilitychange ?? []) fn();
    },
    setOnScreen(onScreen) { for (const cb of observers) cb([{ isIntersecting: onScreen }]); },
    fire(type, event = {}) { for (const fn of listeners[type] ?? []) fn(event); },
  };
}

const SIMS = ["tpu-topology-explorer", "scale-hierarchy", "tpu-ocs-explorer"];
const MESHES = ["tpu-topology-explorer", "scale-hierarchy"]; // 3D meshes with easing and auto-rotation
const SECONDS = (s) => Math.ceil((s * 1000) / FRAME_MS); // frame intervals in `s` seconds

for (const id of SIMS) {
  test(`${id}: no frames while the tab is hidden; it resumes when shown`, () => {
    const sim = loadSim(id);
    sim.run("start()");
    assert.ok(sim.pump(5) > 0, "draws while visible");
    sim.setVisible(false);
    sim.pump(3); // a frame already queued runs once and doesn't queue another
    assert.equal(sim.pending(), 0);
    sim.setVisible(true);
    assert.ok(sim.pending() > 0, "resumes when shown");
  });

  test(`${id}: no frames while it's scrolled off screen; it resumes on screen`, () => {
    const sim = loadSim(id);
    sim.run("start()");
    sim.pump(5);
    sim.setOnScreen(false);
    sim.pump(3);
    assert.equal(sim.pending(), 0);
    sim.setOnScreen(true);
    assert.ok(sim.pending() > 0);
  });
}

for (const id of MESHES) {
  test(`${id}: auto-rotation runs for 10 s after the last interaction, then rests; a drag restarts it`, () => {
    const sim = loadSim(id);
    sim.run("start()");
    sim.pump(SECONDS(8));
    assert.ok(sim.pending() > 0, "still rotating 8 s after starting");
    sim.pump(SECONDS(4));
    assert.equal(sim.pending(), 0, "resting after 10 s: an open, idle page costs no CPU");
    sim.run("isDragging = true");
    sim.fire("pointermove", { clientX: 40, clientY: 10 });
    assert.ok(sim.pending() > 0, "a drag draws again");
  });

  test(`${id}: under reduced motion it stops once the view settles; a drag or a resize draws again`, () => {
    const sim = loadSim(id, { reducedMotion: true });
    sim.run("start()");
    sim.pump(SECONDS(5));
    assert.equal(sim.pending(), 0, "settled: nothing queued");

    sim.run("isDragging = true");
    sim.fire("pointermove", { clientX: 40, clientY: 10 });
    assert.ok(sim.pending() > 0, "a drag draws again");
    sim.pump(10);
    assert.ok(sim.pending() > 0, "and keeps drawing while the pointer is down");
    sim.run("isDragging = false");
    sim.pump(SECONDS(5));
    assert.equal(sim.pending(), 0);

    sim.fire("resize");
    assert.ok(sim.pending() > 0, "a resize (which clears the canvas) redraws");
    sim.pump(SECONDS(5));
    assert.equal(sim.pending(), 0);
  });

  for (const cancel of ["pointercancel", "blur"]) {
    test(`${id}: a drag ended by ${cancel} (not pointerup) returns to idle`, () => {
      const sim = loadSim(id);
      sim.run("start()");
      sim.pump(SECONDS(12));
      assert.equal(sim.pending(), 0);
      sim.run("isDragging = true");
      sim.fire("pointermove", { clientX: 40, clientY: 10 });
      sim.fire(cancel);
      assert.equal(sim.run("isDragging"), false);
      sim.pump(SECONDS(12));
      assert.equal(sim.pending(), 0, "no endless drawing after a cancelled gesture");
    });
  }

  test(`${id}: re-rendering (a tab or level change) doesn't stack window drag listeners`, () => {
    const sim = loadSim(id);
    sim.run("start()");
    sim.run("renderUI(); renderUI(); renderUI()");
    for (const type of ["pointermove", "pointerup", "pointercancel", "blur"]) {
      assert.equal(sim.listenerCount(type), 1, `one ${type} listener, however often the view re-renders`);
    }
  });
}

test("tpu-ocs-explorer: the photon flow runs for 10 s after the last operation, then rests; a new operation restarts it", () => {
  const sim = loadSim("tpu-ocs-explorer");
  sim.run("start()");
  sim.pump(SECONDS(8));
  assert.ok(sim.pending() > 0, "still flowing 8 s after starting");
  sim.pump(SECONDS(4));
  assert.equal(sim.pending(), 0, "resting after 10 s");
  sim.run('setMode("slice")');
  assert.ok(sim.pending() > 0, "choosing an operation draws again");
  sim.pump(SECONDS(12));
  assert.equal(sim.pending(), 0, "and rests again once the mirrors settle and 10 s pass");
});

test("tpu-ocs-explorer: a failure run completes, splices in the spare, and then rests", () => {
  const sim = loadSim("tpu-ocs-explorer");
  sim.run("start()");
  sim.run("triggerFailure()");
  sim.pump(SECONDS(1.5));
  assert.equal(sim.run("T.hold"), true, "cube 2 is down, holding the event open");
  sim.pump(SECONDS(1.5));
  assert.equal(sim.run("JSON.stringify(routes)"), "[1,7,null,4,5,6,0,3]", "the spare is spliced in");
  sim.pump(SECONDS(12));
  assert.equal(sim.run("T.hold"), false);
  assert.equal(sim.run("T.eventActive"), false);
  assert.equal(sim.pending(), 0);
});

test("tpu-ocs-explorer: switching operations between the failure's two steps clears its hold, so the sim settles and rests", () => {
  const sim = loadSim("tpu-ocs-explorer");
  sim.run("start()");
  sim.run("triggerFailure()");
  sim.pump(SECONDS(1.6)); // after the 1.4 s step (cube 2 down), before the 2.5 s repair
  assert.equal(sim.run("T.hold"), true);
  sim.run('setMode("ring")'); // cancels the repair step
  sim.pump(SECONDS(12));
  assert.equal(sim.run("T.hold"), false, "the cancelled run's hold is cleared");
  assert.equal(sim.run("T.eventActive"), false, "the reconfiguration event ends");
  assert.equal(sim.pending(), 0, "and the loop rests");
  const down = sim.run("T.downTotal");
  sim.pump(SECONDS(5));
  assert.equal(sim.run("T.downTotal"), down, "downtime stops accumulating");
});

test("tpu-ocs-explorer: hidden during a failure run, its steps still apply; shown again, it draws, then rests", () => {
  const sim = loadSim("tpu-ocs-explorer");
  sim.run("start()");
  sim.run("triggerFailure()");
  sim.pump(SECONDS(0.5));
  sim.setVisible(false);
  sim.pump(SECONDS(3)); // both timed steps fire while hidden
  assert.equal(sim.pending(), 0, "no frames while hidden");
  assert.equal(sim.run("JSON.stringify(routes)"), "[1,7,null,4,5,6,0,3]");
  sim.setVisible(true);
  assert.ok(sim.pending() > 0, "draws the new state when shown");
  sim.pump(SECONDS(12));
  assert.equal(sim.run("T.eventActive"), false);
  assert.equal(sim.pending(), 0);
});
