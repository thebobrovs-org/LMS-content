// LMS-content#190 review: behaviour the agentic-ai Wave 1 simulations teach, run against each real main.js in the
// small DOM of sim-dom.mjs.
// - approval-gate-explorer: the same refund rides two tracks; one denial keeps the money on the top track (approval
//   before issue_refund) and is too late on the bottom one (review after it); a refund under the threshold is not asked.
// - state-scope-explorer: a populated user: key survives a restart on DatabaseSessionService and is lost on
//   InMemorySessionService; a session key is not read in a new session of the same user, a user: key is; a temp:
//   key is gone next turn; an app: key reaches another user.
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
  await sim.press("#put-user");
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
  await sim.press('[data-service="memory"]');
  assert.match(text(sim, "#caption"), /empty store/, "switching service says it resets the exercise");
  await writeUserKeyAndRestart(sim);
  assert.equal(text(sim, "#merged"), "{ }");
});

test("state-scope-explorer: a temp: key is gone on the next turn", async () => {
  const sim = await loadSim("state-scope-explorer");
  await sim.press("#put-temp");
  assert.match(text(sim, "#merged"), /"temp:language": "fr"/);
  await sim.press("#turn");
  assert.equal(text(sim, "#merged"), "{ }");
});

test("state-scope-explorer: a new session reads the user: key but not the session key", async () => {
  const sim = await loadSim("state-scope-explorer");
  await sim.press("#put-session"); // language, no prefix
  await sim.press("#put-user");
  assert.ok(!sim.events.includes("checkpoint:observe-user-scope"));
  await sim.press('[data-predict="fridge"]');
  await sim.press("#new-session");
  const merged = text(sim, "#merged");
  assert.match(merged, /"user:language": "fr"/);
  assert.doesNotMatch(merged, /"language": "fr"/);
  assert.ok(sim.events.includes("checkpoint:observe-user-scope"));
  assert.match(text(sim, "#verdict"), /^Right/);
  await sim.press('[data-user="Ben"]');
  assert.equal(text(sim, "#merged"), "{ }", "another user reads neither key");
});

test("state-scope-explorer: an app: key reaches every user", async () => {
  const sim = await loadSim("state-scope-explorer");
  await sim.press("#put-app");
  await sim.press('[data-user="Ben"]');
  assert.match(text(sim, "#merged"), /"app:language": "fr"/);
});

test("context-budget-explorer: compacting without pinning loses the order id and fails recall", async () => {
  const sim = await loadSim("context-budget-explorer");
  await sim.press('[data-predict="long_session_recall"]');
  await sim.press("#compact");
  assert.match(text(sim, "#cases"), /long_session_recall ?✗ Fail/);
  assert.match(text(sim, "#verdict"), /^Right/);
  await sim.press("#pin");
  assert.match(text(sim, "#cases"), /long_session_recall ?✓ Pass/);
});

test("context-budget-explorer: top 5 drops the return-policy chunk unless reranked", async () => {
  const sim = await loadSim("context-budget-explorer");
  await sim.press('[data-topk="5"]');
  assert.match(text(sim, "#cases"), /long_session_recall ?✗ Fail/);
  await sim.press("#rerank");
  assert.match(text(sim, "#cases"), /rank 2/);
});

test("context-budget-explorer: lean and passing fires the checkpoint; caching cuts the bill, not the tokens", async () => {
  const sim = await loadSim("context-budget-explorer");
  await sim.press('[data-tools="careless"]');
  await sim.press("#compact");
  await sim.press("#pin");
  await sim.press('[data-memory="load"]');
  assert.ok(!sim.events.includes("checkpoint:observe-evidence-survives"), "a lost check_warranty still fails a case");
  await sim.press('[data-tools="filtered"]');
  assert.ok(sim.events.includes("checkpoint:observe-evidence-survives"));
  assert.match(text(sim, "#r-total"), /^20,500/);
  await sim.press("#cache");
  assert.match(text(sim, "#r-total"), /^20,500/, "caching doesn't shrink the context");
  assert.match(text(sim, "#r-billed"), /16,000 uncached/);
});

test("workflow-vs-agent-stepper: on a partly shipped order the tram hands off and the car redirects a part", async () => {
  const sim = await loadSim("workflow-vs-agent-stepper");
  await sim.press('[data-v="tram"][data-predict="help"]');
  for (let i = 0; i < 6; i++) await sim.press("#step");
  const caption = text(sim, "#caption");
  assert.match(caption, /Handed to a person; nothing changed, with 1 model call/);
  assert.match(caption, /Part A1234-2 will go to your new address/);
  assert.match(text(sim, "#verdict"), /Workflow: right/);
  assert.ok(sim.events.includes("checkpoint:observe-who-decides"));
});

test("workflow-vs-agent-stepper: with the expected result both change the address, and only the unexpected run fires the checkpoint", async () => {
  const sim = await loadSim("workflow-vs-agent-stepper");
  await sim.press('[data-result="expected"]');
  for (let i = 0; i < 6; i++) await sim.press("#step");
  assert.match(text(sim, "#caption"), /Same outcome\. The rails used 1 model call, the driver 3/);
  assert.ok(!sim.events.includes("checkpoint:observe-who-decides"));
});
