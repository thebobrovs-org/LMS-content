// B08 oauth-consent-pause, run against the real main.js in the small DOM of sim-dom.mjs:
// - three-legged OAuth for Ana's mailbox: the password goes only to Google's sign-in page, the code
//   travels browser → client app → agent and is spent at Google, the token carries gmail.compose, and the
//   checkpoint fires once, at the retried call;
// - the agent's own bucket uses service-account authentication, not a consent pause, and no password or code;
// - the shortcut puts the password inside the credential boundary.
// Run by `npm run gate`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSim } from "./sim-dom.mjs";

const text = (sim, sel) => sim.find(sel).textContent.replace(/\s+/g, " ").trim();
const holds = (sim) => text(sim, "#holds");
const steps = async (sim, n) => {
  for (let i = 0; i < n; i++) await sim.press("#step");
};
const fired = (sim) => sim.events.filter((e) => e === "checkpoint:observe-consent-pause").length;

test("oauth-consent-pause: 3LO pauses, sends Ana to Google, and only Google's page sees the password", async () => {
  const sim = await loadSim("oauth-consent-pause");
  await sim.press('[data-predict="agent"]');
  assert.equal(text(sim, "#verdict"), "", "no verdict before the consent step");
  await steps(sim, 1);
  assert.match(text(sim, "#caption"), /pauses the run/);
  assert.match(text(sim, "#svg"), /adk_request_credential/);
  await steps(sim, 2);
  assert.match(text(sim, "#caption"), /password goes only here/);
  assert.match(holds(sim), /PasswordGoogle's sign-in page only/);
  assert.match(text(sim, "#verdict"), /You picked: The agent\. Not so/);
});

test("oauth-consent-pause: the code is drawn back to the client app and exchanged; the token is scoped", async () => {
  const sim = await loadSim("oauth-consent-pause");
  await steps(sim, 4);
  assert.match(text(sim, "#svg"), /redirect_uri\?code=/);
  assert.match(holds(sim), /CodeAna's browser/);
  await steps(sim, 1);
  assert.match(holds(sim), /Codeclient app/);
  await steps(sim, 1);
  assert.match(text(sim, "#svg"), /FunctionResponse\(callback URL\)/);
  assert.match(holds(sim), /Codeagent/);
  await steps(sim, 1);
  assert.match(text(sim, "#svg"), /code \+ client ID \+ secret/);
  assert.match(holds(sim), /Codespent at Google/);
  await steps(sim, 1);
  assert.match(holds(sim), /Tokenagent: gmail\.compose/);
  assert.equal(fired(sim), 0);
  await steps(sim, 2);
  assert.match(text(sim, "#svg"), /draft saved for Ana/);
  assert.equal(fired(sim), 1);
  await sim.press("#back");
  await steps(sim, 3);
  assert.equal(fired(sim), 1, "fires once");
});

test("oauth-consent-pause: the agent's own bucket uses its service account, with no consent and no password", async () => {
  const sim = await loadSim("oauth-consent-pause");
  await sim.press('[data-flow="own"]');
  await steps(sim, 1);
  assert.match(text(sim, "#svg"), /service-account auth \(ADC\)/);
  assert.doesNotMatch(text(sim, "#svg"), /client_credentials/);
  assert.match(holds(sim), /Passwordnone: no user involved/);
  await steps(sim, 3);
  assert.match(text(sim, "#caption"), /excessive agency/);
  assert.equal(fired(sim), 0);
});

test("oauth-consent-pause: asking for the password breaches the boundary", async () => {
  const sim = await loadSim("oauth-consent-pause");
  await sim.press('[data-flow="shortcut"]');
  await steps(sim, 2);
  assert.match(text(sim, "#svg"), /Boundary breached/);
  assert.match(holds(sim), /Passwordclient app, agent, the model/);
  await sim.press("#reset");
  assert.equal(sim.find('[data-flow="user"]').getAttribute("aria-pressed"), "true");
});
