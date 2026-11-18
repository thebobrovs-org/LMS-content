// LMS-content#190 review: behaviour the agentic-ai Wave 1 simulations teach, run against each real main.js in the
// small DOM of sim-dom.mjs.
// - approval-gate-explorer: the same refund rides two tracks; one denial keeps the money on the top track (approval
//   before issue_refund) and is too late on the bottom one (review after it); a refund under the threshold is not asked.
// - state-scope-explorer: a populated user: key survives a restart on DatabaseSessionService and is lost on
//   InMemorySessionService; a session key is not read in a new session of the same user, a user: key is; a temp:
//   key is gone next turn; an app: key reaches another user.
// - rag-retrieval-tuner: recall 1/1 still grounds "60 days" on the superseded FAQ; a bigger net or the reranker
//   does not fix it, the metadata filter does and fires the checkpoint; small chunks split out the final-sale rule.
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

test("rag-retrieval-tuner: recall 1/1 and still 60 days; a bigger net or the reranker does not fix it", async () => {
  const sim = await loadSim("rag-retrieval-tuner");
  await sim.press('[data-predict="right"]');
  assert.equal(text(sim, "#verdict"), "", "no verdict before the first cast");
  await sim.press("#cast");
  assert.match(text(sim, "#verdict"), /^Not quite: on your first cast the agent said 60 days/);
  assert.match(text(sim, "#caption"), /^Grounded, cited and wrong/);
  assert.match(text(sim, "#caption"), /recall 1\/1/);
  assert.match(text(sim, "#caption"), /precision 1\/3/);
  await sim.press("#topk", "6");
  assert.match(text(sim, "#caption"), /bigger net/);
  await sim.press("#rerank");
  assert.match(text(sim, "#caption"), /reranker still doesn't fix it/);
  assert.ok(!sim.events.includes("checkpoint:observe-stale-grounding"));
});

test("rag-retrieval-tuner: the metadata filter, not more chunks, fixes it and fires the checkpoint", async () => {
  const sim = await loadSim("rag-retrieval-tuner");
  await sim.press("#filter");
  assert.ok(!sim.events.includes("checkpoint:observe-stale-grounding"), "nothing fires before a cast");
  await sim.press("#filter");
  await sim.press("#cast");
  await sim.press("#filter");
  assert.match(text(sim, "#caption"), /^Correct and complete/);
  assert.ok(sim.events.includes("checkpoint:observe-stale-grounding"));
});

test("rag-retrieval-tuner: small chunks split the final-sale rule out; recall 1/2 until reranked", async () => {
  const sim = await loadSim("rag-retrieval-tuner");
  await sim.press('[data-chunk="small"]');
  await sim.press("#filter");
  await sim.press("#cast");
  assert.match(text(sim, "#caption"), /^Right window/);
  assert.match(text(sim, "#caption"), /recall 1\/2/);
  await sim.press("#rerank");
  assert.match(text(sim, "#caption"), /^Correct and complete \(precision 2\/3, recall 2\/2\)/);
  await sim.press("#topk", "1");
  await sim.press("#rerank");
  assert.match(text(sim, "#caption"), /^No policy fish/);
});

test("rag-retrieval-tuner: the verdict grades the first cast as it was set, not the default scenario", async () => {
  const sim = await loadSim("rag-retrieval-tuner");
  await sim.press("#filter");
  await sim.press('[data-predict="right"]');
  await sim.press("#cast");
  assert.match(text(sim, "#verdict"), /^Right: on your first cast the agent said 30 days/);
  assert.equal(sim.find("#verdict").getAttribute("role"), "status");
});

test("rag-retrieval-tuner: with top 1 the narration never claims the current policy was caught", async () => {
  const sim = await loadSim("rag-retrieval-tuner");
  await sim.press("#topk", "1");
  assert.match(text(sim, "#question"), /top 1 medium chunks\. What will/);
  await sim.press('[data-predict="wrong"]');
  await sim.press("#cast");
  assert.match(text(sim, "#caption"), /too small to reach the current policy \(recall 0\/1\)/);
  assert.doesNotMatch(text(sim, "#caption"), /is in the bucket/);
  assert.match(text(sim, "#verdict"), /^Right: .*only reached the superseded FAQ/);
  await sim.press("#topk", "2");
  assert.match(text(sim, "#caption"), /too small to reach the current policy/);
});

test("rag-retrieval-tuner: Reset restarts the prediction cycle but the checkpoint fires once", async () => {
  const sim = await loadSim("rag-retrieval-tuner");
  await sim.press('[data-predict="right"]');
  await sim.press("#cast");
  await sim.press("#filter");
  assert.ok(sim.events.includes("checkpoint:observe-stale-grounding"));
  await sim.press("#reset");
  assert.equal(text(sim, "#verdict"), "");
  assert.equal(text(sim, "#cast"), "Cast the net");
  assert.match(text(sim, "#caption"), /Make your prediction/);
  await sim.press("#filter");
  await sim.press('[data-predict="right"]');
  await sim.press("#cast");
  assert.match(text(sim, "#verdict"), /^Right: on your first cast the agent said 30 days/);
  assert.equal(sim.events.filter((e) => e === "checkpoint:observe-stale-grounding").length, 1);
});
