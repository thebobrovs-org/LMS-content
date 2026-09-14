// Tests for pipeline/knowledge-search.mjs (hyperstack#70): the retrieval step the authoring
// skills run before they write. Run by `npm run gate`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { RANK_MAX, format, rank, search, tokens } from "./knowledge-search.mjs";

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

test("tokens are lowercase words of two or more characters, stopwords dropped, numbers kept, a trailing s folded whenever two characters remain", () => {
  assert.deepEqual(tokens("Why does a 129×129 matmul waste slots on TPUs?"), ["129", "129", "matmul", "waste", "slot", "tpu"]);
  assert.deepEqual(tokens("Loss scaling"), ["loss", "scaling"]);
  assert.deepEqual(tokens("class pass"), ["class", "pass"]);
  assert.deepEqual(tokens("IPs and an IP"), ["ip", "ip"]); // a three-character plural folds to its two-character singular
  assert.deepEqual(tokens("is us"), ["us"]); // "is" is a stopword; "us" is not folded to one character
  assert.deepEqual(tokens(undefined), []);
});

test("rank scores each distinct question token by where it appears (title 3, scope 2, tag 2, slug 1), boosts the topic, drops zero scores, keeps k, and breaks ties by id", () => {
  const top = rank(INDEX, "What does fusion do to the math, and to the tiles?");
  assert.deepEqual(top.map((h) => [h.record.id, h.score, h.matched]), [
    ["misconception/fusion-reduces-flops", 11, ["fusion", "math"]], // fusion: title 3 + scope 2 + tag 2 + id slug 1; math: title 3
    ["claim/padding-to-tile-multiples", 5, ["math", "tile"]], // math: the topic's subject slug 1; tiles → tile: title 3 + the objective slug 1
    ["concept/jax-compile-path", 1, ["fusion"]], // the item slug predict-fusion
  ]);
  // The topic boost adds 2 to every record touching the topic, with or without a token match.
  assert.deepEqual(rank(INDEX, "tiles", { topic: "ml-systems/jax-xla-stack" }).map((h) => [h.record.id, h.score]), [["claim/padding-to-tile-multiples", 4], ["concept/jax-compile-path", 2], ["misconception/fusion-reduces-flops", 2]]);
  assert.deepEqual(rank(INDEX, "tpu", { topic: "ml-systems/jax-xla-stack" }).map((h) => [h.record.id, h.score]), [["concept/jax-compile-path", 5], ["claim/padding-to-tile-multiples", 2], ["misconception/fusion-reduces-flops", 2]]);
  assert.deepEqual(rank(INDEX, "tpu", { k: 1 }).map((h) => [h.record.id, h.score]), [["concept/jax-compile-path", 3]]); // title 3 beats scope 2
  assert.deepEqual(rank(INDEX, "nothing like this at all"), []);
  assert.deepEqual(rank(INDEX, "fusion fusion FUSION").map((h) => h.score), [8, 1]); // a repeated token counts once
});

test("a record's kind is not searchable: a question naming claims, concepts or misconceptions scores nothing on that word; a reference's kind neither", () => {
  assert.deepEqual(rank(INDEX, "claim"), []);
  assert.deepEqual(rank(INDEX, "concept misconception"), []);
  assert.deepEqual(rank(INDEX, "objective item sim"), []);
  assert.deepEqual(rank(INDEX, "tiler").map((h) => [h.record.id, h.score]), [["claim/padding-to-tile-multiples", 1]]); // the sim's slug, not its kind
});

test("rank refuses an empty question and a k outside 1..RANK_MAX", () => {
  assert.throws(() => rank(INDEX, ""), /needs a question/);
  assert.throws(() => rank(INDEX, undefined), /needs a question/);
  assert.throws(() => rank(INDEX, "tpu", { k: 0 }), /1 to 50/);
  assert.throws(() => rank(INDEX, "tpu", { k: -1 }), RangeError);
  assert.throws(() => rank(INDEX, "tpu", { k: 1.5 }), RangeError);
  assert.throws(() => rank(INDEX, "tpu", { k: RANK_MAX + 1 }), RangeError);
  assert.equal(rank(INDEX, "tpu", { k: RANK_MAX }).length, 2);
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
  const ranked = cli("--rank", "does fusion do less math?");
  assert.equal(ranked.status, 0);
  assert.match(ranked.stdout, /^ 14  misconception\/fusion-reduces-flops  \(fusion, less, math\)\n/);
  const rankedJson = JSON.parse(cli("--json", "--rank", "tiles", "--k", "1").stdout);
  assert.deepEqual(rankedJson, [{ id: "claim/padding-to-tile-multiples", score: 4, matched: ["tile"] }]); // title 3 + the objective slug 1
  assert.match(cli("--rank", "zzz").stdout, /no record scores/);
  // Malformed ranking arguments fail with status 2 and a reason, never a misleading listing.
  for (const bad of [["--rank"], ["--rank", ""], ["--rank", "tpu", "--k", "nope"], ["--rank", "tpu", "--k", "-1"], ["--rank", "tpu", "--k", "0"], ["--rank", "tpu", "--k", "51"]]) {
    const r = cli(...bad);
    assert.equal(r.status, 2, bad.join(" "));
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /--rank needs a question|--k must be an integer from 1 to 50/);
  }
  fs.rmSync(root, { recursive: true, force: true });
});
