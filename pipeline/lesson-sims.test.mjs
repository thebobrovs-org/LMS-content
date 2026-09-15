// Tests for pipeline/lesson-sims.mjs (LMS-content#110): the simulations a lesson embeds are the
// compiled <Simulation id> elements, never a mention in prose or a code block; the map the index
// carries names, per simulation, the published topics that embed it, drafts and staging left out.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { publishedLessons, simsIn, simulationTopics } from "./lesson-sims.mjs";

const lesson = (status, body) => `---\nid: x\ntitle: T\nstatus: ${status}\n---\n${body}`;

test("simsIn reads the compiled <Simulation id> elements once each, not prose, code or a body that does not compile", async () => {
  assert.deepEqual(await simsIn('Text about `<Simulation id="not-this" />`.\n\n<Simulation id="matmul-tiler" />\n\n```mdx\n<Simulation id="nor-this" />\n```\n\n<Simulation id="roofline" />\n<Simulation id="matmul-tiler" />\n'), ["matmul-tiler", "roofline"]);
  assert.deepEqual(await simsIn("plain prose\n"), []);
  assert.deepEqual(await simsIn("<Simulation id={1 + 1} />\n"), [], "an id that is not a string is not a simulation");
  assert.deepEqual(await simsIn("<Broken\n"), [], "a body that does not compile embeds none; the validator reports it");
});

test("simulationTopics maps each simulation to the published topics that embed it, sorted; drafts, staging and an unreadable file are left out", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lesson-sims-"));
  try {
    const write = (p, text) => {
      fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
      fs.writeFileSync(path.join(root, p), text);
    };
    write("topics/math-infra/tensor-shapes.mdx", lesson("published", '<Simulation id="matmul-tiler" />\n<Simulation id="roofline" />\n'));
    write("topics/ml-systems/jax-xla-stack.mdx", lesson("published", 'Prose.\n\n<Simulation id="matmul-tiler" />\n'));
    write("topics/ml-systems/no-sims.mdx", lesson("published", "Prose only.\n"));
    write("topics/ml-systems/drafted.mdx", lesson("draft", '<Simulation id="secret" />\n'));
    write("staging/topics/ml-systems/staged.mdx", lesson("published", '<Simulation id="staged-only" />\n'));
    write("topics/ml-systems/broken.mdx", "---\n: not yaml\n---\n<Simulation id=\"x\" />\n");
    assert.deepEqual(
      (await publishedLessons(root)).map((l) => [l.id, l.sims]),
      [
        ["math-infra/tensor-shapes", ["matmul-tiler", "roofline"]],
        ["ml-systems/jax-xla-stack", ["matmul-tiler"]],
        ["ml-systems/no-sims", []],
      ],
    );
    assert.deepEqual(await simulationTopics(root), { "matmul-tiler": ["math-infra/tensor-shapes", "ml-systems/jax-xla-stack"], roofline: ["math-infra/tensor-shapes"] });
    assert.deepEqual(await simulationTopics(path.join(root, "nowhere")), {}, "no topics folder: an empty map");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
