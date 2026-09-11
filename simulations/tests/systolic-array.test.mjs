// Pins the systolic-array simulation's numbers (LMS-content#57). It runs the real
// simulations/packages/systolic-array/main.js in a Node vm, with stub DOM and sim-SDK
// objects, and replays step(). Tests live outside simulations/packages, so they never
// ship with the sim. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const MAIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "../packages/systolic-array/main.js");

/** Load main.js in a fresh context. No DOM: getElementById returns null, which the sim tolerates. */
function loadSim() {
  const events = [];
  const context = vm.createContext({
    document: { getElementById: () => null, documentElement: { dataset: {} }, body: { scrollHeight: 0 } },
    requestAnimationFrame: () => 0,
    setTimeout: () => 0,
    setInterval: () => 0,
    clearInterval: () => {},
    createSim: () => ({
      checkpoint: (id) => events.push(`checkpoint:${id}`),
      event: (name, data) => events.push(`${name}:${data.cycle}`),
      resize: () => {},
      isInitialized: () => true,
    }),
  });
  vm.runInContext(fs.readFileSync(MAIN, "utf8"), context, { filename: MAIN });
  return { events, run: (code) => vm.runInContext(code, context) };
}

/** Pump the array to the end; per heartbeat, the busy cells and the bottom-row outputs. */
function pump(sim) {
  return sim.run(`
    resetArray();
    const beats = [];
    while (cycle < TOTAL) {
      step();
      beats.push({
        busy: peGrid.flat().filter((cell) => cell.act > 0).length,
        bottom: peGrid[SIZE - 1].map((cell) => (cell.act > 0 ? cell.psum : null)),
      });
    }
    JSON.stringify(beats);
  `);
}

test("utilization per heartbeat is 1, 3, 6, 7, 6, 3, 1 of 9 cells: 27 MACs in 7 cycles, peaking at heartbeat 4", () => {
  const sim = loadSim();
  const beats = JSON.parse(pump(sim));
  assert.deepEqual(beats.map((b) => b.busy), [1, 3, 6, 7, 6, 3, 1]);
  assert.equal(sim.run("TOTAL"), 7); // the "exactly 7 cycles" the Why tab states
  assert.equal(sim.run("PEAK"), 4);
  assert.equal(Math.max(...beats.map((b) => b.busy)), 7); // never 9 at once in this example
  assert.equal(beats.reduce((sum, b) => sum + b.busy, 0), 27); // 3 input vectors × 9 MACs
});

test("the array computes the real matmul: each input vector times the weights", () => {
  const sim = loadSim();
  const beats = JSON.parse(pump(sim));
  const W = JSON.parse(sim.run("JSON.stringify(WEIGHTS)"));
  const INPUT = JSON.parse(sim.run("JSON.stringify(INPUT)"));
  const n = W.length;
  // Row r's queue is skewed by r beats, so input vector k's element r is INPUT[r][k + r].
  const x = (k) => Array.from({ length: n }, (_, r) => INPUT[r][k + r]);
  const expected = Array.from({ length: n }, (_, k) => Array.from({ length: n }, (_, c) => x(k).reduce((sum, v, r) => sum + v * W[r][c], 0)));
  // Output (k, c) leaves the bottom row at heartbeat k + c + n.
  const got = Array.from({ length: n }, (_, k) => Array.from({ length: n }, (_, c) => beats[k + c + n - 1].bottom[c]));
  assert.deepEqual(got, expected);
});

test("the narration and the Why tab state the computed numbers", () => {
  const sim = loadSim();
  assert.match(sim.run("narrate(4)"), /peak utilization: 7 of 9 cells/);
  assert.match(sim.run("narrate(7)"), /last multiply-accumulate: all 27/);
  for (let c = 1; c <= 7; c++) {
    const line = sim.run(`narrate(${c})`);
    if (c !== 4) assert.doesNotMatch(line, /peak/i, `heartbeat ${c}: ${line}`);
  }
  const why = sim.run("renderWhy()");
  assert.match(why, /exactly 7 cycles/);
  assert.match(why, /Up to 7 of the 9 cells/);
  assert.doesNotMatch(why, /9 ops concurrently/);
});

test("the checkpoint fires once, right after the last heartbeat, and its id is unchanged", () => {
  const sim = loadSim();
  pump(sim);
  sim.run("step()"); // past the end: no extra heartbeat, no second checkpoint
  assert.deepEqual(sim.events, [...[1, 2, 3, 4, 5, 6].map((c) => `cycle:${c}`), "checkpoint:observe-matmul", "cycle:7"]);
});
