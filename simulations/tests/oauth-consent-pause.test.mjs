// Behavior tests for B08 (oauth-consent-pause) using sim-dom.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSim } from "./sim-dom.mjs";

const text = (sim, sel) => sim.find(sel).textContent.replace(/\s+/g, " ").trim();

test("oauth-consent-pause: 3LO steps through consent outside the Credential Boundary and fires checkpoint once at step 5", async () => {
  const sim = await loadSim("oauth-consent-pause");

  // Predict "Only the Auth Server"; verdict stays hidden until consent step 3.
  await sim.press('[data-predict="auth"]');
  assert.equal(text(sim, ".verdict"), "");

  // Step 1 -> 2 (redirect) -> 3 (consent outside boundary)
  await sim.press('[data-action="next"]');
  await sim.press('[data-action="next"]');
  assert.match(text(sim, ".caption"), /Credential Boundary/);
  assert.match(text(sim, ".verdict"), /only the Auth Server handles the user's password/i);
  assert.ok(!sim.events.includes("checkpoint:observe-consent-pause"));

  // Step 4 -> 5 (scoped retry) fires checkpoint once
  await sim.press('[data-action="next"]');
  await sim.press('[data-action="next"]');
  assert.match(text(sim, ".caption"), /user-scoped access_token/);
  const checkpoints = sim.events.filter((e) => e === "checkpoint:observe-consent-pause");
  assert.equal(checkpoints.length, 1);

  // Replay and step back to 5 should not fire checkpoint a second time
  await sim.press('[data-action="next"]');
  await sim.press('[data-action="next"]');
  await sim.press('[data-action="next"]');
  await sim.press('[data-action="next"]');
  await sim.press('[data-action="next"]');
  assert.equal(sim.events.filter((e) => e === "checkpoint:observe-consent-pause").length, 1);
});

test("oauth-consent-pause: 2LO mode skips user/app redirect and warns against using 2LO for user mail", async () => {
  const sim = await loadSim("oauth-consent-pause");

  await sim.press('[data-flow="2lo"]');
  assert.match(text(sim, ".caption"), /client_credentials|service credentials/i);

  await sim.press('[data-action="next"]');
  await sim.press('[data-action="next"]');
  assert.match(text(sim, ".caption"), /excessive agency/i);
  assert.ok(!sim.events.includes("checkpoint:observe-consent-pause"));
});
