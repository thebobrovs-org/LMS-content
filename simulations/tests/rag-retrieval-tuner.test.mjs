// Behavior tests for B06 (rag-retrieval-tuner) using sim-dom.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSim } from "./sim-dom.mjs";

const text = (sim, sel) => sim.find(sel).textContent.replace(/\s+/g, " ").trim();

test("rag-retrieval-tuner: default has 100% recall, 33% precision, and wrong grounded answer; filter fixes it and fires checkpoint once", async () => {
  const sim = await loadSim("rag-retrieval-tuner");

  // Default: medium, topK=3, rerank=false, filter=false
  assert.equal(text(sim, "#recVal"), "1/1 (100%)");
  assert.equal(text(sim, "#precVal"), "1/3 (33%)");
  assert.match(text(sim, "#caption"), /60 days|superseded/i);
  assert.ok(!sim.events.includes("checkpoint:observe-stale-grounding"));

  // Turning on metadata filter removes 2024 FAQ -> 2026 policy is caught, checkpoint fires once
  await sim.press("#filterBtn");
  assert.equal(text(sim, "#recVal"), "1/1 (100%)");
  assert.match(text(sim, "#caption"), /2026 policy leads the catch/i);
  assert.equal(sim.events.filter((e) => e === "checkpoint:observe-stale-grounding").length, 1);

  // Toggling filter off and back on does not fire checkpoint a second time
  await sim.press("#filterBtn");
  await sim.press("#filterBtn");
  assert.equal(sim.events.filter((e) => e === "checkpoint:observe-stale-grounding").length, 1);
});

test("rag-retrieval-tuner: small chunks split the 2026 policy into 2 relevant chunks; reranking restores 100% recall", async () => {
  const sim = await loadSim("rag-retrieval-tuner");

  await sim.press('[data-chunk="small"]');
  await sim.press("#filterBtn");
  // Without rerank, top-3 catches Shipping, 2026 Policy (30d), Exchanges -> 1/2 (50%) recall
  assert.equal(text(sim, "#recVal"), "1/2 (50%)");
  assert.equal(text(sim, "#precVal"), "1/3 (33%)");

  // With rerank, 2026 Final-sale lifts into top-3 -> 2/2 (100%) recall, 2/3 (67%) precision
  await sim.press("#rerankBtn");
  assert.equal(text(sim, "#recVal"), "2/2 (100%)");
  assert.equal(text(sim, "#precVal"), "2/3 (67%)");
});
