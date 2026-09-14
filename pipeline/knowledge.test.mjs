// Tests for pipeline/knowledge.mjs (LMS-content#105): records load and check against the schema,
// every reference must resolve, an approved record needs a source, a disputed record that a
// published lesson depends on names its issue, a question record carries no person, duplicates
// and near-duplicates are caught, and the index holds approved records only, with links both
// ways. Run by `npm run gate`.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { buildIndex, identifierIn, indexText, linksIn, loadRecords, recordProblems } from "./knowledge.mjs";

const RECORD = (over = {}, body = "**Claim.** Bytes over a boundary set the intensity.\n") => {
  const fm = {
    id: "claim/bytes-set-intensity",
    type: "claim",
    status: "approved",
    scope: "Roofline at one boundary",
    sources: ["Williams et al. (2008), Roofline, §2"],
    touches: ["math-infra/precision-and-memory"],
    reviewed: "2026-09-12",
    ...over,
  };
  const yaml = Object.entries(fm)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : typeof v === "object" ? `\n${Object.entries(v).map(([a, b]) => `  ${a}: ${JSON.stringify(b)}`).join("\n")}` : JSON.stringify(v)}`)
    .join("\n");
  return `---\n${yaml}\n---\n\n${body}`;
};

/** A knowledge/ folder in a temp dir with these files (path → text), loaded. */
function load(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lms-knowledge-"));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, "knowledge", path.dirname(f)), { recursive: true });
    fs.writeFileSync(path.join(root, "knowledge", f), text);
  }
  const out = loadRecords(path.join(root, "knowledge"), root);
  fs.rmSync(root, { recursive: true, force: true });
  return out;
}

const resolveAll = () => ({ ok: true });

test("a well-formed record loads; the schema refuses an unknown field, a mismatched type prefix and a superseded record without its successor", () => {
  const ok = load({ "claims/bytes-set-intensity.md": RECORD() });
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.records.length, 1);
  assert.equal(ok.records[0].title, "Bytes set intensity");
  assert.deepEqual(ok.records[0].sources, ["Williams et al. (2008), Roofline, §2"]);

  const bad = load({
    "claims/bytes-set-intensity.md": RECORD({ owner: "someone" }),
    "claims/wrong-type.md": RECORD({ id: "claim/wrong-type", type: "decision" }),
    "claims/old.md": RECORD({ id: "claim/old", status: "superseded" }),
  });
  assert.equal(bad.records.length, 0);
  assert.match(bad.problems.join("\n"), /owner/);
  assert.match(bad.problems.join("\n"), /must start with "decision\/"/);
  assert.match(bad.problems.join("\n"), /names the record that replaces it/);
});

test("a record lives in its type's folder under its slug; v0's single source still counts", () => {
  const r = load({ "decisions/bytes-set-intensity.md": RECORD(), "claims/legacy.md": RECORD({ id: "claim/legacy", sources: undefined, source: "A locator, §1" }) });
  assert.match(r.problems.join("\n"), /lives at knowledge\/claims\/bytes-set-intensity\.md/);
  assert.deepEqual(r.records.find((x) => x.id === "claim/legacy").sources, ["A locator, §1"]);
});

test("references must resolve, an approved record needs a source, and the messages say what is missing", () => {
  const { records } = load({
    "claims/bytes-set-intensity.md": RECORD({ touches: ["math-infra/precision-and-memory", "objective:math-infra/precision-and-memory#missing"] }),
    "claims/no-source.md": RECORD({ id: "claim/no-source", sources: [], touches: [] }),
    "claims/proposed.md": RECORD({ id: "claim/proposed", status: "proposed", sources: [], touches: [] }),
  });
  const resolve = (ref) => (ref.includes("#missing") ? { ok: false, why: 'names objective "missing", which the topic does not declare' } : { ok: true });
  const { errors } = recordProblems(records, { resolve });
  assert.deepEqual(errors, [
    'knowledge/claims/bytes-set-intensity.md: touches "objective:math-infra/precision-and-memory#missing", which names objective "missing", which the topic does not declare',
    "knowledge/claims/no-source.md: an approved record names at least one source",
  ]);
});

test("a disputed record that a published lesson depends on names its issue; one nothing published depends on need not", () => {
  const { records } = load({
    "claims/bytes-set-intensity.md": RECORD({ status: "disputed" }),
    "claims/staged-only.md": RECORD({ id: "claim/staged-only", status: "disputed", touches: ["staging/topic"] }),
    "claims/named.md": RECORD({ id: "claim/named", status: "disputed", "disputed-by": "thebobrovs-org/LMS-content#123" }),
  });
  const { errors } = recordProblems(records, { resolve: resolveAll, publishedTopic: (ref) => ref === "math-infra/precision-and-memory" });
  assert.deepEqual(errors, ["knowledge/claims/bytes-set-intensity.md: a disputed record that a published lesson depends on names the open issue on that lesson (disputed-by: owner/repo#n)"]);
});

test("links in the body and `related` must be records; a duplicate id and a look-alike title are caught; an overdue review warns", () => {
  const { records } = load({
    "claims/bytes-set-intensity.md": RECORD({ related: ["misconception/nope"] }, "See [claim/other](../claims/other.md) and `concept/none`.\n"),
    "claims/other.md": RECORD({ id: "claim/other", title: "Bytes set intensity!", reviewed: "2025-01-01", "review-by": "2026-01-01" }),
  });
  // A second file with the same id can only sit at another path, which the loader already refuses; the check stays as a second net.
  const dup = { ...records[1], file: "knowledge/concepts/dup.md" };
  const { errors, warnings } = recordProblems([...records, dup], { resolve: resolveAll, today: "2026-09-13" });
  assert.deepEqual(errors.sort(), [
    "knowledge/claims/bytes-set-intensity.md: links to \"concept/none\", which is not a record",
    "knowledge/claims/bytes-set-intensity.md: links to \"misconception/nope\", which is not a record",
    "knowledge/concepts/dup.md: id \"claim/other\" is also knowledge/claims/other.md's",
  ]);
  assert.deepEqual(warnings, [
    "knowledge/claims/other.md: past its review-by date (2026-01-01)",
    "knowledge/claims/other.md: its title reads like knowledge/claims/bytes-set-intensity.md's (\"Bytes set intensity\"): one idea, one record",
    "knowledge/concepts/dup.md: past its review-by date (2026-01-01)",
    "knowledge/concepts/dup.md: its title reads like knowledge/claims/bytes-set-intensity.md's (\"Bytes set intensity\"): one idea, one record",
  ]);
  assert.deepEqual(linksIn("[claim/a](x) [[claim/b]] `decision/c` decision/d"), ["claim/a", "claim/b", "decision/c"]);
});

test("a question record carries no person: an e-mail address or an @handle is refused", () => {
  const { records } = load({
    "questions/why-bf16.md": RECORD({ id: "question/why-bf16", type: "question", status: "proposed", sources: [] }, "Asked by ada@example.com: why does bf16 keep fp32's range?\n"),
    "questions/why-fp8.md": RECORD({ id: "question/why-fp8", type: "question", status: "proposed", sources: [] }, "Why does fp8 need scaling? (@someone asked)\n"),
    "questions/clean.md": RECORD({ id: "question/clean", type: "question", status: "proposed", sources: [] }, "Why does fp8 need scaling? Mail the `@channel` alias.\n"),
  });
  const { errors } = recordProblems(records, { resolve: resolveAll });
  assert.deepEqual(errors, [
    'knowledge/questions/why-bf16.md: a question record carries what looks like a person ("ada@example.com"); rewrite the question without it',
    'knowledge/questions/why-fp8.md: a question record carries what looks like a person ("@someone"); rewrite the question without it',
  ]);
  assert.equal(identifierIn("a `@channel` in backticks is a code span, not a handle"), null);
});

test("the index carries approved records only, sorted, with links both ways, and is deterministic", () => {
  const { records } = load({
    "claims/bytes-set-intensity.md": RECORD({}, "Relies on [concept/roofline](../concepts/roofline.md).\n"),
    "concepts/roofline.md": RECORD({ id: "concept/roofline", type: "concept", title: "The roofline model", tags: ["performance"], "review-by": "2027-09-12" }),
    "claims/draft.md": RECORD({ id: "claim/draft", status: "proposed", sources: [] }, "Links [claim/bytes-set-intensity](x).\n"),
  });
  const index = buildIndex(records);
  assert.deepEqual(index.records.map((r) => r.id), ["claim/bytes-set-intensity", "concept/roofline"]);
  assert.deepEqual(index.records[0].links, ["concept/roofline"]);
  assert.deepEqual(index.records[1].backlinks, ["claim/bytes-set-intensity"]);
  assert.equal(index.records[1].title, "The roofline model");
  assert.deepEqual(index.records[1].tags, ["performance"]);
  assert.equal(index.records[1].reviewBy, "2027-09-12");
  assert.ok(!JSON.stringify(index).includes("claim/draft"), "a proposed record never reaches the index");
  assert.equal(indexText(index), indexText(buildIndex([...records].reverse())));
});
