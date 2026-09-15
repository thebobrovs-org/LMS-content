// Tests for pipeline/knowledge-search.mjs (hyperstack#70): the retrieval step the authoring
// skills run before they write. Run by `npm run gate`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { RANK_MAX, SYNONYMS, expandSynonyms, format, rank, search, tokens, touchesTopic } from "./knowledge-search.mjs";

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

test("a record touches a topic through each reference form: the topic, an objective, an item, a step, and a simulation or a checkpoint of one the lesson embeds; never through a simulation the lesson does not embed (LMS-content#110)", () => {
  const T = "math-infra/tensor-shapes";
  const index = {
    version: 1,
    simulations: { "matmul-tiler": [T, "ml-systems/jax-xla-stack"], roofline: ["ml-systems/jax-xla-stack"] },
    records: [
      rec("claim/by-topic", "By topic", "s", [T]),
      rec("claim/by-topic-prefix", "By topic prefix", "s", [`topic:${T}`]),
      rec("claim/by-objective", "By objective", "s", [`objective:${T}#tile-padding`]),
      rec("claim/by-item", "By item", "s", [`item:${T}#predict-padding`]),
      rec("claim/by-step", "By step", "s", [`step:${T}:make-waste-appear`]),
      rec("claim/by-sim", "By sim", "s", ["sim:matmul-tiler"]),
      rec("claim/by-checkpoint", "By checkpoint", "s", ["checkpoint:matmul-tiler/tile-fit"]),
      rec("claim/other-sim", "Other sim", "s", ["sim:roofline"]),
      rec("claim/other-topic", "Other topic", "s", ["ml-systems/jax-xla-stack", "objective:ml-systems/jax-xla-stack#x"]),
    ],
  };
  assert.deepEqual(search(index, { topic: T }).map((r) => r.id), ["claim/by-topic", "claim/by-topic-prefix", "claim/by-objective", "claim/by-item", "claim/by-step", "claim/by-sim", "claim/by-checkpoint"]);
  assert.deepEqual(search(index, { topic: "ml-systems/jax-xla-stack" }).map((r) => r.id), ["claim/by-sim", "claim/by-checkpoint", "claim/other-sim", "claim/other-topic"]);
  assert.equal(touchesTopic({ records: [] }, index.records[5], T), false, "an index without the map: a simulation reference reaches no topic");
  // A reference named like an inherited property, or a map entry that is not a list, reaches no topic and never throws (LMS-content#116).
  const inherited = rec("claim/inherited", "Inherited", "s", ["sim:constructor", "checkpoint:constructor/x", "sim:toString", "sim:__proto__", "sim:hasownproperty"]);
  assert.equal(touchesTopic(index, inherited, T), false);
  assert.equal(touchesTopic({ ...index, simulations: { "matmul-tiler": "math-infra/tensor-shapes" } }, index.records[5], T), false, "a map entry that is not a list");
  assert.equal(touchesTopic({ ...index, simulations: null }, index.records[5], T), false, "a null map");
  const withInherited = { ...index, records: [...index.records, inherited] };
  assert.deepEqual(search(withInherited, { topic: T }).map((r) => r.id).includes("claim/inherited"), false);
  assert.equal(rank(withInherited, "inherited", { topic: T }).find((h) => h.record.id === "claim/inherited")?.score, 4, "ranked on its title (3) and slug (1), with no topic boost");
  assert.equal(touchesTopic(index, rec("claim/odd", "o", "s", ["sim:Matmul-Tiler", "checkpoint:matmul-tiler"]), T), false, "a reference that is not of the schema's shape is not resolved");
  assert.deepEqual(rank(index, "by sim", { topic: T, k: 2 }).map((h) => [h.record.id, h.score]), [["claim/by-sim", 6], ["claim/other-sim", 4]], "the topic boost (2) reaches a record through the embedded simulation, not one through another lesson's");
});

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
  for (const bad of [["--rank"], ["--rank", ""], ["--rank", "tpu", "--k"], ["--rank", "tpu", "--k", "nope"], ["--rank", "tpu", "--k", "-1"], ["--rank", "tpu", "--k", "0"], ["--rank", "tpu", "--k", "51"]]) {
    const r = cli(...bad);
    assert.equal(r.status, 2, bad.join(" "));
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /--rank needs a question|--k must be an integer from 1 to 50/);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test("rank scores a question word found in a record's terms 2, like a tag, and expands the question with the synonym map first: a question in other words finds the record without the map being tuned to it (LMS-content#111)", () => {
  const index = {
    records: [
      { id: "claim/elementwise-ops-are-memory-bound-alone", title: "A large, simple elementwise kernel on its own is memory-bound at the HBM boundary", scope: "Elementwise operations on accelerators", tags: ["roofline", "fusion"], terms: [], touches: ["ml-systems/jax-xla-stack"] },
      { id: "concept/tensor-shape-sets-the-footprint", title: "A tensor's shape sets its footprint", scope: "Dense tensors on accelerators", tags: [], terms: ["shape", "dimension", "element count", "footprint", "layout", "allocation"], touches: ["math-infra/tensor-shapes"] },
      { id: "claim/static-shapes-recompile", title: "A new input shape recompiles a jitted function", scope: "JAX on XLA", tags: ["xla"], touches: ["ml-systems/jax-xla-stack"] },
    ],
  };
  // The terms: "allocation" is neither in the title nor the scope; it scores 2 through the terms, and the word is reported as matched.
  const byTerm = rank(index, "allocation layout", { k: 3 });
  assert.deepEqual(byTerm.map((r) => [r.record.id, r.score, r.matched]), [["concept/tensor-shape-sets-the-footprint", 4, ["allocation", "layout"]]]);
  // The synonyms: "pointwise" and "bandwidth-limited" become "elementwise" and "memory-bound" as well, so the claim scores on its title; a record without terms is unaffected.
  const q14 = rank(index, "Is a pointwise op like GELU bandwidth-limited when it runs by itself?", { k: 3 });
  assert.equal(q14[0].record.id, "claim/elementwise-ops-are-memory-bound-alone");
  assert.ok(q14[0].matched.includes("elementwise") && q14[0].matched.includes("memory") && q14[0].matched.includes("bound"));
  // "buffer" and "allocates" reach the footprint concept through its terms; the recompile claim still leads on its own words.
  const q16 = rank(index, "When a new shape forces a recompile, can the buffer XLA allocates be larger than the element count?", { k: 3 });
  assert.deepEqual(q16.map((r) => r.record.id).slice(0, 2).sort(), ["claim/static-shapes-recompile", "concept/tensor-shape-sets-the-footprint"]);
  assert.equal(expandSynonyms("Is a Pointwise op bandwidth-limited? half precision, mantissa."), "Is a Pointwise elementwise op bandwidth-limited memory-bound? half precision fp16, mantissa significand.");
  assert.equal(expandSynonyms("nonpointwise bandwidth-limitedness"), "nonpointwise bandwidth-limitedness", "a phrase matches on word boundaries only");
  assert.equal(expandSynonyms(""), "");
  for (const [from, to] of Object.entries(SYNONYMS)) assert.match(to, /^[a-z0-9-]+( [a-z0-9-]+)*$/, `${from} → ${to} is words`);
  assert.ok(Object.isFrozen(SYNONYMS));
});
