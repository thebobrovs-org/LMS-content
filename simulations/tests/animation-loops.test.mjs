// LMS-content#58: the canvas sims draw only while they're visible (tab shown, sim on
// screen) and something is moving. Auto-motion rests 10 s after the last interaction,
// and under reduced motion there's none, so an idle page costs no CPU. Each real
// main.js runs in a Node vm with a stub DOM, a fake requestAnimationFrame queue, a fake
// clock and a controllable IntersectionObserver. Run by `npm run gate`.
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
  const observers = []; // IntersectionObserver callbacks
  const listeners = {}; // document and window listeners, by event type
  const state = { visibility: "visible", now: 0 };
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
    setTimeout: () => 0,
    clearTimeout: () => {},
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
    /** Run up to `n` rounds of queued frames, FRAME_MS apart; returns how many callbacks ran. */
    pump(n = 1) {
      let ran = 0;
      for (let k = 0; k < n && frames.length; k++) {
        state.now += FRAME_MS;
        for (const cb of frames.splice(0)) { cb(state.now); ran++; }
      }
      return ran;
    },
    pending: () => frames.length,
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
const SECONDS = (s) => Math.ceil((s * 1000) / FRAME_MS); // frame rounds in `s` seconds

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
