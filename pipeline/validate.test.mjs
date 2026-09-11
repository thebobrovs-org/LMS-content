// Tests for pipeline/validate.mjs (LMS-content#73): the gate rejects every fixture from
// the baseline review, an MDX file that doesn't compile, and a published path that
// lists a draft or staged topic; and it accepts a well-formed tree. Each case runs the
// real validator on a scratch content tree. Run by `npm run gate`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VALIDATE = path.join(REPO, "pipeline", "validate.mjs");

const TOPIC = `---
title: Arrays
summary: Contiguous memory.
tags: [fundamentals]
difficulty: beginner
estimatedMinutes: 5
updated: "2026-09-11"
---

# Arrays

An <Term k="array">array</Term> is contiguous. <Simulation id="demo-sim" />

![memory](/media/array.svg)
`;
const PATH_MDX = `---
title: Foundations
summary: Start here.
levels:
  - level: 100
    title: Basics
    topics: [fundamentals/arrays]
---

A path.
`;

/** A minimal, valid content tree in a temp dir; `edits` overwrite files (null deletes). */
function tree(edits = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lms-content-"));
  const files = {
    "topics/fundamentals/arrays.mdx": TOPIC,
    "paths/foundations.mdx": PATH_MDX,
    "glossary/foundations.json": JSON.stringify({ array: { definition: "A block of memory." } }),
    "resources/foundations.json": JSON.stringify([{ type: "prompt", title: "Quiz me", prompt: "Ask.", topic: "fundamentals/arrays" }]),
    "simulations/packages/demo-sim/sim.config.json": JSON.stringify({ id: "demo-sim", title: "Demo", version: "1.0.0" }),
    "media/array.svg": "<svg/>",
    ...edits,
  };
  for (const [f, body] of Object.entries(files)) {
    if (body === null) continue;
    fs.mkdirSync(path.join(root, path.dirname(f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), body);
  }
  // The validator resolves its imports from the repo, so link node_modules and the modules it needs.
  fs.symlinkSync(path.join(REPO, "node_modules"), path.join(root, "node_modules"));
  return root;
}

function run(root, ...args) {
  const r = spawnSync(process.execPath, [VALIDATE, ...args], { cwd: root, encoding: "utf8" });
  fs.rmSync(root, { recursive: true, force: true });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

const fm = (patch) => TOPIC.replace(/^---\n([\s\S]*?)\n---/, (_, body) => `---\n${body}\n${patch}\n---`);
const withTitle = (title) => TOPIC.replace("title: Arrays", `title: ${title}`);

test("a well-formed tree passes, with and without staging", () => {
  const ok = run(tree());
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /every \.mdx compiles/);
  const staged = run(tree({ "staging/topics/fundamentals/lists.mdx": withTitle("Lists").replace("fundamentals/arrays", "x") }), "--staging");
  assert.equal(staged.code, 0, staged.out);
});

test("the baseline review's fixtures fail", () => {
  const cases = {
    "a numeric title": { "topics/fundamentals/arrays.mdx": withTitle("42") },
    "a video without youtubeId": { "topics/fundamentals/arrays.mdx": fm("videos:\n  - title: Intro") },
    "a flashcard without back": { "topics/fundamentals/arrays.mdx": fm("flashcards:\n  - front: Only") },
    "an unquoted date": { "topics/fundamentals/arrays.mdx": TOPIC.replace('updated: "2026-09-11"', "updated: 2026-09-11") },
    "a frontmatter id overriding the path-derived id": { "topics/fundamentals/arrays.mdx": fm("id: other/topic") },
    "missing media": { "media/array.svg": null },
    "a malformed sim.config.json": { "simulations/packages/demo-sim/sim.config.json": JSON.stringify({ id: "demo-sim", version: "1" }) },
    "a sim.config.json whose id isn't its directory": { "simulations/packages/demo-sim/sim.config.json": JSON.stringify({ id: "other", title: "D", version: "1.0.0" }) },
    "a glossary entry without a definition": { "glossary/foundations.json": JSON.stringify({ array: { see: "list" } }) },
    "a resource of an unknown type": { "resources/foundations.json": JSON.stringify([{ type: "podcast", title: "P", url: "https://x.y" }]) },
    "a resource for a topic that doesn't exist": { "resources/foundations.json": JSON.stringify([{ type: "prompt", title: "P", prompt: "p", topic: "no/such" }]) },
    "MDX that doesn't compile": { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<Unclosed>\n` },
    "a topic with an unknown frontmatter key": { "topics/fundamentals/arrays.mdx": fm("estimatedMinute: 5") },
  };
  for (const [name, edits] of Object.entries(cases)) {
    const r = run(tree(edits));
    assert.equal(r.code, 1, `${name} should fail:\n${r.out}`);
    assert.match(r.out, /content validation failed/, name);
  }
});

test("a published path may list only published topics; a staged topic is never listed", () => {
  const draftTopic = TOPIC.replace("---\ntitle", "---\nstatus: draft\ntitle");
  const r1 = run(tree({ "topics/fundamentals/arrays.mdx": draftTopic }));
  assert.equal(r1.code, 1);
  assert.match(r1.out, /is a draft, and this path is published/);
  // The same topic under a draft path is fine.
  const r2 = run(tree({ "topics/fundamentals/arrays.mdx": draftTopic, "paths/foundations.mdx": PATH_MDX.replace("---\n\nA path", "status: draft\n---\n\nA path") }));
  assert.equal(r2.code, 0, r2.out);
  // A staged topic listed by a path: an error even with --staging, and even on a draft path.
  const staged = {
    "topics/fundamentals/arrays.mdx": null,
    "staging/topics/fundamentals/arrays.mdx": TOPIC,
    "resources/foundations.json": "[]",
    "paths/foundations.mdx": PATH_MDX.replace("---\n\nA path", "status: draft\n---\n\nA path"),
  };
  const r3 = run(tree(staged), "--staging");
  assert.equal(r3.code, 1);
  assert.match(r3.out, /is staged, not published/);
});

test("problems name the file, and a parse failure doesn't stop the run", () => {
  const r = run(tree({ "topics/fundamentals/arrays.mdx": TOPIC.replace("---\ntitle", "---js\ntitle"), "glossary/foundations.json": "{not json" }));
  assert.equal(r.code, 1);
  assert.match(r.out, /topics\/fundamentals\/arrays\.mdx: frontmatter must be YAML/);
  assert.match(r.out, /glossary\/foundations\.json: invalid JSON/);
});
