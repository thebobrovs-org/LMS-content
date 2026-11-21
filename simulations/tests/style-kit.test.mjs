// One look for every sim: a package whose style.css starts with the sim-kit block carries it
// byte for byte as simulations/kit/sim-kit.css has it, so the sims can't drift into ten styles
// (skills/lms-authoring-simulations/SKILL.md, "One visual style"). The sims named in ON_KIT must
// use it; every new sim should join them. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const KIT = fs.readFileSync(path.join(ROOT, "kit/sim-kit.css"), "utf8");
const START = KIT.slice(0, KIT.indexOf("\n"));
const ON_KIT = ["approval-gate-explorer", "media-reference-explorer", "access-boundary-explorer", "rag-retrieval-tuner", "guardrail-visibility", "oauth-consent-pause", "hybrid-agent-flow", "platform-map-explorer", "workflow-canvas-flow", "enterprise-data-flow", "a2a-vs-mcp-flow", "threat-defence-flow", "gateway-registry-flow", "continuous-eval-loop", "capstone-architecture-explorer", "customization-guarantees-flow", "model-requirement-picker", "trace-waterfall-explorer", "context-loading-flow", "agents-cli-loop", "sandbox-ladder-explorer", "mcp-routes-explorer", "adk-anatomy-explorer", "eval-case-explorer", "memory-timeline-flow", "rag-backend-lanes", "guardrail-layers-flow", "autonomy-cost-radar", "agent-credential-flow", "auth-manager-flow", "cx-route-resolver", "cx-instruction-vs-flow"];

test("the kit opens with its marker line and closes with its end marker", () => {
  assert.match(START, /^\/\* sim-kit v\d+:/);
  assert.match(KIT.trimEnd(), /\/\* end sim-kit v\d+ \*\/$/);
});

for (const id of fs.readdirSync(path.join(ROOT, "packages"))) {
  const file = path.join(ROOT, "packages", id, "style.css");
  if (!fs.existsSync(file)) continue;
  const css = fs.readFileSync(file, "utf8");
  const uses = css.startsWith("/* sim-kit v");
  if (!uses && !ON_KIT.includes(id)) continue;
  test(`${id}: style.css starts with the sim kit, unchanged`, () => {
    assert.ok(css.startsWith(KIT), `${id}/style.css must begin with simulations/kit/sim-kit.css exactly; copy it again and put the sim's own rules after it`);
  });
}

test("the authoring template starts with the sim kit, so a sim copied from it does too", () => {
  const css = fs.readFileSync(path.join(ROOT, "..", "skills/lms-authoring-simulations/template/style.css"), "utf8");
  assert.ok(css.startsWith(KIT), "skills/lms-authoring-simulations/template/style.css must begin with simulations/kit/sim-kit.css exactly");
});
