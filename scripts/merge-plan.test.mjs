// Batch merging (AGENTS.md, "Merging a batch of PRs"): only PRs that share files wait on each other.
import assert from "node:assert/strict";
import { test } from "node:test";
import { describe, plan } from "./merge-plan.mjs";

const pr = (number, paths, mainSince = []) => ({ number, files: paths.map((p) => (typeof p === "string" ? { status: "M", path: p } : p)), mainSince });

test("PRs with no shared files all merge together in round 1", () => {
  const r = plan([pr(3, ["topics/a/x.mdx"]), pr(1, ["topics/a/y.mdx"]), pr(2, ["media/z.png"])]);
  assert.deepEqual(r.rounds, [[1, 2, 3]]);
  assert.deepEqual(r.alone, []);
  assert.match(describe(r), /Round 1 — merge together, as they are.*#1 #2 #3/);
});

test("PRs sharing a file (directly or through another PR) merge one per round", () => {
  const r = plan([
    pr(10, ["topics/a/x.mdx", "glossary/p.json"]),
    pr(11, ["topics/a/y.mdx", "glossary/p.json"]),
    pr(12, ["topics/a/z.mdx", "topics/a/y.mdx"]),
    pr(13, ["topics/b/w.mdx"]),
  ]);
  assert.deepEqual(r.rounds, [[10, 13], [11], [12]]);
  assert.match(describe(r), /Round 2 — merge main into each, wait for green CI/);
});

test("a PR that changes the gate, or deletes or renames a file, merges alone", () => {
  const r = plan([
    pr(1, ["topics/a/x.mdx"]),
    pr(2, ["pipeline/validate.mjs"]),
    pr(3, [{ status: "D", path: "topics/a/old.mdx" }]),
    pr(4, [{ status: "R100", path: "topics/a/q.mdx" }, { status: "R100", path: "topics/a/r.mdx" }]),
    pr(5, ["package-lock.json"]),
  ]);
  assert.deepEqual(r.rounds, [[1]]);
  assert.deepEqual(r.alone.map((a) => a.number), [2, 3, 4, 5]);
  assert.match(describe(r), /one at a time/);
});

test("a PR whose base predates a gate change on main, or a change to its own files, takes main first", () => {
  const r = plan([
    pr(1, ["topics/a/x.mdx"], ["schema/content-schema.mjs"]),
    pr(2, ["topics/a/y.mdx"], ["topics/a/y.mdx"]),
    pr(3, ["topics/a/z.mdx"], ["topics/b/other.mdx"]),
  ]);
  assert.deepEqual(r.rounds, [[3], [1, 2]]);
  assert.match(r.update[1], /gate/);
  assert.match(r.update[2], /topics\/a\/y\.mdx/);
  assert.equal(r.update[3], undefined);
});

test("when every PR must take main, there is no as-is round", () => {
  const r = plan([pr(1, ["topics/a/x.mdx"], ["pipeline/validate.mjs"])]);
  assert.deepEqual(r.rounds, [[1]]);
  assert.match(describe(r), /Round 1 — merge main into each/);
});

test("a PR that must take main goes after the as-is PRs of its group, never beside them", () => {
  const r = plan([
    pr(1, ["glossary/p.json"], ["schema/content-schema.mjs"]),
    pr(2, ["glossary/p.json", "topics/a/x.mdx"]),
  ]);
  assert.deepEqual(r.rounds, [[2], [1]]);
});
