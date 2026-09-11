// Tests for pipeline/glossary.mjs and the per-file authoring validator that uses it
// (LMS-content#63), run by `npm run gate`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { effectiveGlossary, pathsByTopic, termKeys } from "./glossary.mjs";
import { validateFile } from "../skills/lms-authoring-topics/scripts/validate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_VALIDATOR = path.join(ROOT, "skills/lms-authoring-topics/scripts/validate.mjs");

function walkMdx(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walkMdx(full) : e.name.endsWith(".mdx") ? [full] : [];
  });
}

/** A throwaway content repo: `files` maps relative paths to contents. Returns its root. */
function fixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "glossary-"));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}
const topicWith = (body) => `---\ntitle: T\nsummary: S\ndifficulty: beginner\nestimatedMinutes: 5\ntags: [x]\n---\n${body}\n`;
const pathListing = (title, ...topics) => `---\ntitle: ${title}\nsummary: s\nlevels:\n  - level: 100\n    topics: [${topics.join(", ")}]\n---\n`;

test("a topic's terms resolve in its paths' glossaries, or in all of them if it's in no path", () => {
  const glossaries = { a: { x: {} }, b: { y: {} }, c: { z: {} } };
  const byTopic = pathsByTopic([
    { pid: "a", data: { levels: [{ topics: ["t1"] }] } },
    { pid: "b", data: { levels: [{ topics: ["t1", "t2"] }] } },
  ]);
  assert.deepEqual(Object.keys(effectiveGlossary("t1", glossaries, byTopic)).sort(), ["x", "y"]);
  assert.deepEqual(Object.keys(effectiveGlossary("t2", glossaries, byTopic)), ["y"]);
  assert.deepEqual(Object.keys(effectiveGlossary("loose", glossaries, byTopic)).sort(), ["x", "y", "z"]);
});

test("a term's key is its id attribute, or else its text, lower-cased and trimmed", () => {
  assert.deepEqual(termKeys('A <Term id="Hash Function">hashes</Term> into a <Term> Bucket </Term>.'), ["hash function", "bucket"]);
});

test("the per-file validator passes on every published topic", () => {
  const topics = walkMdx(path.join(ROOT, "topics"));
  assert.ok(topics.length > 10, "found the published topics");
  const failing = topics
    .map((f) => [path.relative(ROOT, f), validateFile(path.relative(ROOT, f), ROOT)])
    .filter(([, errors]) => errors.length);
  assert.deepEqual(failing, []);
});

test("the per-file validator uses per-path glossaries, like the repo validator", () => {
  const root = fixture({
    "topics/s/t.mdx": topicWith("<Term>alpha</Term> and <Term>beta</Term>"),
    "topics/s/loose.mdx": topicWith("<Term>beta</Term>"),
    "paths/p1.mdx": pathListing("P1", "s/t"),
    "glossary/p1.json": JSON.stringify({ alpha: { definition: "a" } }),
    "glossary/p2.json": JSON.stringify({ beta: { definition: "b" } }),
  });
  // t is in p1, so beta (defined only in p2) doesn't resolve for it.
  assert.deepEqual(validateFile("topics/s/t.mdx", root), ['glossary term "beta" is not defined in the glossary of its path(s): p1']);
  // A topic in no path resolves against every glossary.
  assert.deepEqual(validateFile("topics/s/loose.mdx", root), []);
});

test("it also works in the app repo layout (content/…)", () => {
  const root = fixture({
    "content/topics/s/t.mdx": topicWith("<Term>alpha</Term>"),
    "content/paths/p1.mdx": pathListing("P1", "s/t"),
    "content/glossary/p1.json": JSON.stringify({ alpha: { definition: "a" } }),
  });
  assert.deepEqual(validateFile("content/topics/s/t.mdx", root), []);
});

test("with only a legacy glossary.json, every topic resolves against it, in both layouts", () => {
  for (const base of ["", "content/"]) {
    const root = fixture({
      [`${base}topics/s/t.mdx`]: topicWith("<Term>alpha</Term> and <Term>gamma</Term>"),
      [`${base}paths/p1.mdx`]: pathListing("P1", "s/t"), // listed in a path, which has no glossary of its own
      [`${base}glossary.json`]: JSON.stringify({ alpha: { definition: "a" } }),
    });
    assert.deepEqual(validateFile(`${base}topics/s/t.mdx`, root), ['glossary term "gamma" is not defined in glossary.json'], base || "(content repo)");
  }
});

test("a path that can't be parsed stops the glossary check with a diagnostic, instead of widening it", () => {
  const root = fixture({
    "topics/s/t.mdx": topicWith("<Term>beta</Term>"),
    "paths/p1.mdx": "---js\n{ levels: [] }\n---\n", // it may list s/t; nobody can tell
    "glossary/p1.json": "{}",
    "glossary/p2.json": JSON.stringify({ beta: { definition: "b" } }),
  });
  const errors = validateFile("topics/s/t.mdx", root);
  assert.equal(errors.length, 1, errors.join("\n"));
  assert.match(errors[0], /can't check glossary terms: .*paths\/p1\.mdx/);
});

test("a staged topic is found in its path when the root is given as a relative path", () => {
  const root = fixture({
    "staging/topics/s/t.mdx": topicWith("<Term>beta</Term>"),
    "topics/s/other.mdx": topicWith("plain prose"),
    "paths/p1.mdx": pathListing("P1", "s/t"),
    "glossary/p1.json": JSON.stringify({ alpha: { definition: "a" } }),
    "glossary/p2.json": JSON.stringify({ beta: { definition: "b" } }),
  });
  const relativeRoot = path.relative(process.cwd(), root);
  assert.deepEqual(validateFile("staging/topics/s/t.mdx", relativeRoot), ['glossary term "beta" is not defined in the glossary of its path(s): p1']);
});

test("as a command it prints the problems and exits 1, or confirms and exits 0", () => {
  const root = fixture({
    "topics/s/ok.mdx": topicWith("plain prose"),
    "topics/s/bad.mdx": topicWith("<Term>missing</Term>"),
    "glossary/p.json": "{}",
  });
  const run = (file) => spawnSync(process.execPath, [SKILL_VALIDATOR, file], { cwd: root, encoding: "utf8" });
  const ok = run("topics/s/ok.mdx");
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /looks valid/);
  const bad = run("topics/s/bad.mdx");
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /glossary term "missing" is not defined in any path glossary/);
});
