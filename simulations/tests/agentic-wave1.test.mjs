// LMS-content#190 review: behaviour the agentic-ai Wave 1 simulations teach, run against each real main.js in the
// small DOM of sim-dom.mjs.
// - approval-gate-explorer: a refund denied before the tool never highlights the stage where money moves, and the
//   balance never changes; a refund denied after the tool has already moved it.
// - state-scope-explorer: a populated user: key survives a restart on DatabaseSessionService and is lost on
//   InMemorySessionService; a session key is not read in a new session of the same user, a user: key is.
// Run by `npm run gate`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSim } from "./sim-dom.mjs";

const text = (sim, sel) => sim.find(sel).textContent.replace(/\s+/g, " ").trim();

async function stepToEnd(sim) {
  for (let i = 0; i < 10; i++) await sim.press("#step");
}

test("approval-gate-explorer: a denial before the tool never selects the money-moving stage", async () => {
  const sim = await loadSim("approval-gate-explorer");
  // Defaults: €400, before the tool, every refund, deny.
  for (let i = 0; i < 10; i++) {
    await sim.press("#step");
    const now = sim.doc.querySelector(".stage.now");
    assert.ok(now, "a stage is marked current");
    assert.doesNotMatch(now.textContent, /Tool runs/, `step ${i + 2} highlights the execution stage after a pre-tool denial`);
    assert.match(text(sim, "#ledger"), /€5,000\.00/, "the balance never changes");
  }
  assert.match(text(sim, "#readout"), /Denied before issue_refund ran/);
});

test("approval-gate-explorer: a denial after the tool cannot unmove the money", async () => {
  const sim = await loadSim("approval-gate-explorer");
  await sim.press("#placement", "after");
  await stepToEnd(sim);
  assert.match(text(sim, "#ledger"), /€4,600\.00/);
  assert.match(text(sim, "#readout"), /Denied after issue_refund ran/);
});

test("approval-gate-explorer: the checkpoint fires only after a denial in both placements", async () => {
  const sim = await loadSim("approval-gate-explorer");
  await stepToEnd(sim);
  assert.ok(!sim.events.includes("checkpoint:observe-approval-before-side-effect"));
  await sim.press("#placement", "after");
  await stepToEnd(sim);
  assert.ok(sim.events.includes("checkpoint:observe-approval-before-side-effect"));
});

async function writeUserKeyAndRestart(sim) {
  await sim.press("#scope", "user");
  await sim.press("#write");
  assert.match(text(sim, "#merged"), /"user:language": "fr"/, "the user: key is stored before the restart");
  await sim.press("#restart");
}

test("state-scope-explorer: a stored user: key survives a restart on DatabaseSessionService", async () => {
  const sim = await loadSim("state-scope-explorer");
  await writeUserKeyAndRestart(sim);
  assert.match(text(sim, "#merged"), /"user:language": "fr"/);
});

test("state-scope-explorer: a stored user: key is lost on restart with InMemorySessionService", async () => {
  const sim = await loadSim("state-scope-explorer");
  await sim.press("#service", "memory");
  assert.match(text(sim, "#log"), /empty store/, "switching service says it resets the exercise");
  await writeUserKeyAndRestart(sim);
  assert.equal(text(sim, "#merged"), "{ }");
});

test("state-scope-explorer: a new session reads the user: key but not the session key", async () => {
  const sim = await loadSim("state-scope-explorer");
  await sim.press("#write"); // language, no prefix
  await sim.press("#scope", "user");
  await sim.press("#write");
  assert.ok(!sim.events.includes("checkpoint:observe-user-scope"));
  await sim.press("#session", "new");
  const merged = text(sim, "#merged");
  assert.match(merged, /"user:language": "fr"/);
  assert.doesNotMatch(merged, /"language": "fr"/);
  assert.ok(sim.events.includes("checkpoint:observe-user-scope"));
  await sim.press("#user", "Ben");
  assert.equal(text(sim, "#merged"), "{ }", "another user reads neither key");
});
