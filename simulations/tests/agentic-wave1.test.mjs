// LMS-content#190 review: behaviour the agentic-ai Wave 1 simulations teach, run against each real main.js in the
// small DOM of sim-dom.mjs.
// - approval-gate-explorer: the same refund rides two tracks; one denial keeps the money on the top track (approval
//   before issue_refund) and is too late on the bottom one (review after it); a refund under the threshold is not asked.
// - state-scope-explorer: a populated user: key survives a restart on DatabaseSessionService and is lost on
//   InMemorySessionService; a session key is not read in a new session of the same user, a user: key is.
// Run by `npm run gate`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSim } from "./sim-dom.mjs";

const text = (sim, sel) => sim.find(sel).textContent.replace(/\s+/g, " ").trim();

async function sendAndWait(sim) {
  await sim.press("#send");
  await sim.advance(2000);
}

test("approval-gate-explorer: before the denial, the bottom track has already paid and the top has not", async () => {
  const sim = await loadSim("approval-gate-explorer");
  // Defaults: €400, asks on every refund.
  await sendAndWait(sim);
  assert.ok(!sim.find("#decide").hidden, "both signals wait for a decision");
  assert.match(text(sim, "#t-top"), /€5,000/);
  assert.match(text(sim, "#t-bottom"), /€4,600/);
});

test("approval-gate-explorer: a denial keeps the money only where approval stands before the tool", async () => {
  const sim = await loadSim("approval-gate-explorer");
  await sendAndWait(sim);
  await sim.press("#deny");
  await sim.advance(2000);
  assert.ok(sim.find("#decide").hidden);
  assert.match(text(sim, "#t-top"), /€5,000/, "the top vault keeps the refund");
  assert.match(text(sim, "#t-bottom"), /€4,600/, "the bottom vault paid before the review");
  assert.match(text(sim, "#caption"), /This tool call is rejected/);
  assert.match(text(sim, "#caption"), /already gone/);
  assert.ok(sim.events.includes("checkpoint:observe-approval-before-side-effect"));
});

test("approval-gate-explorer: an approval pays on both tracks and fires no checkpoint", async () => {
  const sim = await loadSim("approval-gate-explorer");
  await sendAndWait(sim);
  await sim.press("#approve");
  await sim.advance(2000);
  assert.match(text(sim, "#t-top"), /€4,600/);
  assert.match(text(sim, "#t-bottom"), /€4,600/);
  assert.ok(!sim.events.includes("checkpoint:observe-approval-before-side-effect"));
});

test("approval-gate-explorer: a refund under the threshold is never asked about", async () => {
  const sim = await loadSim("approval-gate-explorer");
  await sim.press('[data-amount="small"]');
  await sim.press("#threshold", "100");
  await sendAndWait(sim);
  assert.ok(sim.find("#decide").hidden, "no decision is asked");
  assert.match(text(sim, "#t-top"), /€4,960/);
  assert.match(text(sim, "#t-bottom"), /€4,960/);
  assert.match(text(sim, "#t-call"), /Not asked/);
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
