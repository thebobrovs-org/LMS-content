// Tests for pipeline/knowledge-search.mjs (hyperstack#70): the retrieval step the authoring
// skills run before they write. Run by `npm run gate`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { format, search } from "./knowledge-search.mjs";

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "knowledge-search.mjs");
const rec = (id, title, scope, touches, tags = [], sources = ["A locator, §1"]) => ({ id, type: id.split("/")[0], title, scope, tags, touches, sources, reviewed: "2026-09-13", reviewBy: null, links: [], backlinks: [], file: `knowledge/${id}.md` });
const INDEX = {
  version: 1,
  records: [
    rec("claim/padding-to-tile-multiples", "A misaligned matmul dimension is executed in whole tiles", "Dense matmuls on Cloud TPU", ["math-infra/tensor-shapes", "objective:math-infra/tensor-shapes#tile-padding", "sim:matmul-tiler"], ["padding", "xla"]),
    rec("concept/jax-compile-path", "From a Python function to a TPU executable", "The JAX compilation pipeline", ["ml-systems/jax-xla-stack", "item:ml-systems/jax-xla-stack#predict-fusion"], ["jax", "xla"]),
    rec("misconception/fusion-reduces-flops", "Fusion makes a chain faster because it does less math", "Learners predicting what fusion changes", ["objective:ml-systems/jax-xla-stack#fusion-hbm-trips"], ["fusion"]),
  ],
};

test("search matches a topic through any of its references, a tag, and every word in the title or scope", () => {
  assert.deepEqual(search(INDEX, { topic: "ml-systems/jax-xla-stack" }).map((r) => r.id), ["concept/jax-compile-path", "misconception/fusion-reduces-flops"]);
  assert.deepEqual(search(INDEX, { tag: "xla" }).map((r) => r.id), ["claim/padding-to-tile-multiples", "concept/jax-compile-path"]);
  assert.deepEqual(search(INDEX, { words: ["Fusion", "math"] }).map((r) => r.id), ["misconception/fusion-reduces-flops"]);
  assert.deepEqual(search(INDEX, { topic: "ml-systems/jax-xla-stack", words: ["tpu"] }).map((r) => r.id), ["concept/jax-compile-path"]);
  assert.deepEqual(search(INDEX, { words: ["nothing-like-this"] }), []);
});

test("the listing names the id, title, scope, references and sources; an empty result says to draft a record", () => {
  const out = format(search(INDEX, { tag: "fusion" }));
  assert.match(out, /^misconception\/fusion-reduces-flops\n  Fusion makes a chain faster/);
  assert.match(out, /touches: objective:ml-systems\/jax-xla-stack#fusion-hbm-trips/);
  assert.match(out, /sources: A locator, §1/);
  assert.match(format([]), /draft a record first/);
});

test("the CLI reads knowledge/index.json under --root, takes --topic, --tag, words and --json, and fails without an index", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lms-search-"));
  const cli = (...args) => spawnSync(process.execPath, [CLI, "--root", root, ...args], { encoding: "utf8" });
  assert.equal(cli("--topic", "x").status, 1);
  fs.mkdirSync(path.join(root, "knowledge"));
  fs.writeFileSync(path.join(root, "knowledge", "index.json"), JSON.stringify(INDEX));
  const byTopic = cli("--topic", "math-infra/tensor-shapes");
  assert.equal(byTopic.status, 0);
  assert.match(byTopic.stdout, /claim\/padding-to-tile-multiples/);
  assert.doesNotMatch(byTopic.stdout, /jax-compile-path/);
  const json = JSON.parse(cli("--json", "--tag", "jax").stdout);
  assert.deepEqual(json.map((r) => r.id), ["concept/jax-compile-path"]);
  assert.match(cli("compilation", "tpu").stdout, /concept\/jax-compile-path/);
  fs.rmSync(root, { recursive: true, force: true });
});
