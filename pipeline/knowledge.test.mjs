// Tests for pipeline/knowledge.mjs (LMS-content#105): records load and check against the schema,
// live at the path their id names, every reference must resolve, an approved record needs a
// source, a disputed record that a published lesson depends on names its issue, a question record
// carries no person anywhere in it, links must point at records, duplicates and near-duplicates
// are caught, and the index holds approved records only, with links both ways; the index CLI's
// --check refuses a stale or missing file. Run by `npm run gate`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildIndex, identifierIn, indexText, linksIn, loadRecords, recordProblems , termsOf } from "./knowledge.mjs";

const INDEX_CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), "knowledge-index.mjs");

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

/** A knowledge/ folder in a temp dir with these files (path → text); the caller removes it. */
function write(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lms-knowledge-"));
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, "knowledge", path.dirname(f)), { recursive: true });
    fs.writeFileSync(path.join(root, "knowledge", f), text);
  }
  return root;
}
function load(files) {
  const root = write(files);
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

test("a record lives in its type's folder under the slug of its own id: a wrong folder and a wrong file name are both refused; v0's single source still counts", () => {
  const r = load({
    "decisions/bytes-set-intensity.md": RECORD(),
    "claims/other-name.md": RECORD({ id: "claim/right-name" }),
    "claims/legacy.md": RECORD({ id: "claim/legacy", sources: undefined, source: "A locator, §1" }),
  });
  assert.match(r.problems.join("\n"), /decisions\/bytes-set-intensity\.md: a claim record "claim\/bytes-set-intensity" lives at knowledge\/claims\/bytes-set-intensity\.md/);
  assert.match(r.problems.join("\n"), /claims\/other-name\.md: a claim record "claim\/right-name" lives at knowledge\/claims\/right-name\.md/);
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

test("links point at records: a Markdown destination must be a record file, an id label must match it, wiki and backtick ids must exist; `related` too", () => {
  const { records } = load({
    "claims/bytes-set-intensity.md": RECORD(
      { related: ["misconception/nope"] },
      "See [claim/other](../claims/other.md), [the concept](../concepts/roofline.md#ridge), [claim/other](../concepts/roofline.md), [gone](../claims/missing.md), [[concept/roofline]], `concept/none`, and [a lesson](/topics/x) or [a paper](https://example.org/p.md).\n",
    ),
    "claims/other.md": RECORD({ id: "claim/other", title: "Another idea" }),
    "concepts/roofline.md": RECORD({ id: "concept/roofline", type: "concept", title: "Roofline" }, "[ref]: ../claims/other.md\n[Other]: <../claims/other.md>\n\nSee [ref], [other][], [claim/bytes-set-intensity][ref], [more](<../claims/missing.md>) and [also][nope].\n"),
  });
  const { errors } = recordProblems(records, { resolve: resolveAll });
  assert.deepEqual(errors.sort(), [
    'knowledge/claims/bytes-set-intensity.md: links to "concept/none", which is not a record',
    "knowledge/claims/bytes-set-intensity.md: links to ../claims/missing.md, which is not a record (no knowledge/claims/missing.md)",
    'knowledge/claims/bytes-set-intensity.md: links to ../concepts/roofline.md under the label "claim/other", which is another record\'s id',
    'knowledge/claims/bytes-set-intensity.md: related names "misconception/nope", which is not a record',
    'knowledge/concepts/roofline.md: links to ../claims/missing.md, which is not a record (no knowledge/claims/missing.md)',
    'knowledge/concepts/roofline.md: links to ../claims/other.md under the label "claim/bytes-set-intensity", which is another record\'s id',
  ]);
  assert.deepEqual(records[0].links.sort(), ["claim/other", "concept/roofline"]);
  assert.deepEqual(records[2].links, ["claim/other"], "reference-style usages resolve through their definitions; an angle-bracket destination is read; an undefined reference is left to Markdown");
  const direct = linksIn("[x](../claims/a.md) [[claim/b]] `decision/c` decision/d", "knowledge/claims/z.md", (id) => id !== "decision/c");
  assert.deepEqual(direct.ids, ["claim/a", "claim/b"]);
  assert.deepEqual(direct.problems, ['links to "decision/c", which is not a record']);
  // A label defined twice resolves through its first definition, as Markdown does; the later one is checked as a destination and never wins (#107).
  const twice = linksIn("[ref] and [also][ref]\n\n[ref]: ../claims/missing.md\n[ref]: ../claims/a.md\n[REF]: ../claims/b.md", "knowledge/claims/z.md", (id) => id !== "claim/missing");
  assert.deepEqual(twice.ids, ["claim/a", "claim/b"], "the definitions' destinations count; the usages resolve to the first, a missing record");
  assert.deepEqual(twice.problems, ["links to ../claims/missing.md, which is not a record (no knowledge/claims/missing.md)"]);
  const first = linksIn("[ref]\n\n[ref]: ../claims/a.md\n[ref]: ../claims/missing.md", "knowledge/claims/z.md", (id) => id !== "claim/missing");
  assert.deepEqual([first.ids, first.problems], [["claim/a"], ["links to ../claims/missing.md, which is not a record (no knowledge/claims/missing.md)"]]);
  // Collapsed reference links [ref][] and angle-bracket destinations with duplicate definitions (#114):
  const collapsed = linksIn("[ref][]\n\n[ref]: <../claims/missing.md>\n[ref]: <../claims/a.md>", "knowledge/claims/z.md", (id) => id !== "claim/missing");
  assert.deepEqual(collapsed.ids, ["claim/a"], "collapsed reference resolves to the first definition; both destinations checked");
  assert.deepEqual(collapsed.problems, ["links to ../claims/missing.md, which is not a record (no knowledge/claims/missing.md)"]);
  // A usage with an id label proves which definition was used (#107, #114):
  const labelWins = linksIn("[claim/other][ref]\n\n[ref]: ../claims/other.md\n[ref]: ../claims/a.md", "knowledge/claims/z.md");
  assert.deepEqual(labelWins.ids.sort(), ["claim/a", "claim/other"]);
  assert.deepEqual(labelWins.problems, [], "usage resolved to claim/other matching its label; if the second had won, a label mismatch would be reported");
  // A duplicate definition under an id label pointing elsewhere is reported:
  const mismatched = linksIn("[claim/other]: ../claims/other.md\n[claim/other]: ../concepts/roofline.md", "knowledge/claims/z.md");
  assert.deepEqual(mismatched.ids.sort(), ["claim/other", "concept/roofline"]);
  assert.deepEqual(mismatched.problems, ['links to ../concepts/roofline.md under the label "claim/other", which is another record\'s id']);
  // Duplicate definitions pointing at the same destination are deduplicated:
  const identical = linksIn("[ref]\n\n[ref]: ../claims/a.md\n[ref]: ../claims/a.md", "knowledge/claims/z.md");
  assert.deepEqual(identical.ids, ["claim/a"]);
  assert.deepEqual(identical.problems, []);
});

test("a duplicate id and a look-alike title are caught, and an overdue review warns", () => {
  const { records } = load({
    "claims/bytes-set-intensity.md": RECORD(),
    "claims/other.md": RECORD({ id: "claim/other", title: "Bytes set intensity!", reviewed: "2025-01-01", "review-by": "2026-01-01" }),
  });
  // A second file with the same id can only sit at another path, which the loader already refuses; the check stays as a second net.
  const dup = { ...records[1], file: "knowledge/concepts/dup.md" };
  const { errors, warnings } = recordProblems([...records, dup], { resolve: resolveAll, today: "2026-09-13" });
  assert.deepEqual(errors, ['knowledge/concepts/dup.md: id "claim/other" is also knowledge/claims/other.md\'s']);
  assert.deepEqual(warnings, [
    "knowledge/claims/other.md: past its review-by date (2026-01-01)",
    "knowledge/claims/other.md: its title reads like knowledge/claims/bytes-set-intensity.md's (\"Bytes set intensity\"): one idea, one record",
    "knowledge/concepts/dup.md: past its review-by date (2026-01-01)",
    "knowledge/concepts/dup.md: its title reads like knowledge/claims/bytes-set-intensity.md's (\"Bytes set intensity\"): one idea, one record",
  ]);
});

test("a question record carries no person anywhere: an e-mail address or an @handle in the body, a code span, the title, a source or the provenance is refused", () => {
  const q = (id, over, body) => RECORD({ id: `question/${id}`, type: "question", status: "proposed", sources: [], ...over }, body);
  const { records } = load({
    "questions/in-body.md": q("in-body", {}, "Asked by ada@example.com: why does bf16 keep fp32's range?\n"),
    "questions/in-code.md": q("in-code", {}, "Why does fp8 need scaling? (`@someone` asked)\n"),
    "questions/in-title.md": q("in-title", { title: "Asked by @grace" }, "Why does fp8 need scaling?\n"),
    "questions/in-source.md": q("in-source", { sources: ["a chat with linus@example.org"] }, "Why does fp8 need scaling?\n"),
    "questions/in-provenance.md": q("in-provenance", { provenance: { origin: "question", by: "agent:claude", from: "DM from @alan" } }, "Why does fp8 need scaling?\n"),
    "questions/in-terms.md": q("in-terms", { terms: ["scaling", "asked by @ada"] }, "Why does fp8 need scaling?\n"),
    "questions/clean.md": q("clean", {}, "Why does fp8 need scaling? The decorator is written jax.jit here, and 1e-7 is a number.\n"),
  });
  const { errors } = recordProblems(records, { resolve: resolveAll });
  assert.deepEqual(errors, [
    'knowledge/questions/in-body.md: a question record carries what looks like a person ("ada@example.com"); rewrite the question without it',
    'knowledge/questions/in-code.md: a question record carries what looks like a person ("@someone"); rewrite the question without it',
    'knowledge/questions/in-provenance.md: a question record carries what looks like a person ("@alan"); rewrite the question without it',
    'knowledge/questions/in-source.md: a question record carries what looks like a person ("linus@example.org"); rewrite the question without it',
    'knowledge/questions/in-terms.md: a question record carries what looks like a person ("@ada"); rewrite the question without it',
    'knowledge/questions/in-title.md: a question record carries what looks like a person ("@grace"); rewrite the question without it',
  ]);
  assert.equal(identifierIn("`@channel` in backticks is still a handle"), "@channel");
  assert.equal(identifierIn("jax.jit at 1e-7, nothing here"), null);
});

test("the index carries approved records only, sorted, with links both ways, and is deterministic", () => {
  const { records } = load({
    "claims/bytes-set-intensity.md": RECORD({}, "Relies on [the roofline](../concepts/roofline.md).\n"),
    "concepts/roofline.md": RECORD({ id: "concept/roofline", type: "concept", title: "The roofline model", tags: ["performance"], "review-by": "2027-09-12" }),
    "claims/draft.md": RECORD({ id: "claim/draft", status: "proposed", sources: [] }, "Links [claim/bytes-set-intensity](../claims/bytes-set-intensity.md).\n"),
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

test("knowledge-index.mjs writes the index, and --check accepts it, refuses a stale or missing one, and never rewrites the file", () => {
  const root = write({ "claims/bytes-set-intensity.md": RECORD(), "claims/draft.md": RECORD({ id: "claim/draft", status: "proposed", sources: [] }) });
  const cli = (...args) => spawnSync(process.execPath, [INDEX_CLI, "--root", root, ...args], { encoding: "utf8" });
  const out = path.join(root, "knowledge", "index.json");
  const missing = cli("--check");
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /out of date/);
  assert.ok(!fs.existsSync(out), "--check writes nothing");
  assert.equal(cli().status, 0);
  const written = fs.readFileSync(out, "utf8");
  assert.match(written, /claim\/bytes-set-intensity/);
  assert.ok(!written.includes("claim/draft"));
  assert.equal(cli("--check").status, 0);
  fs.writeFileSync(out, written.replace("Bytes set intensity", "Edited by hand"));
  const stale = cli("--check");
  assert.equal(stale.status, 1);
  assert.match(fs.readFileSync(out, "utf8"), /Edited by hand/, "--check leaves the file as it found it");
  fs.rmSync(root, { recursive: true, force: true });
});

test("a record's terms are its front matter's terms list plus a concept's Canonical terms line, a parenthesised alias included, lowercased and deduplicated; the index carries them (LMS-content#111)", () => {
  assert.deepEqual(termsOf({ terms: ["Pointwise", "GELU"] }, "**Concept.** x\n\n**Canonical terms.** exponent, significand (mantissa), Dynamic range, precision.\n"), ["pointwise", "gelu", "exponent", "significand", "mantissa", "dynamic range", "precision"]);
  assert.deepEqual(termsOf({}, "no terms line here"), []);
  assert.deepEqual(termsOf({ terms: ["a", "A", " a "] }, ""), ["a"]);
  assert.deepEqual(termsOf({}, "**Canonical terms.** one, two.\n**Canonical terms.** three.\n"), ["one", "two"], "the first line only");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-terms-"));
  fs.mkdirSync(path.join(dir, "knowledge", "concepts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "knowledge", "claims"), { recursive: true });
  fs.writeFileSync(path.join(dir, "knowledge", "concepts", "c.md"), `---\nid: concept/c\ntype: concept\nstatus: approved\nscope: s\nsources: [x]\nterms: [footprint]\nreviewed: 2026-09-01\n---\n**Concept.** c\n\n**Canonical terms.** shape, allocation.\n`);
  fs.writeFileSync(path.join(dir, "knowledge", "claims", "d.md"), `---\nid: claim/d\ntype: claim\nstatus: approved\nscope: s\nsources: [x]\nreviewed: 2026-09-01\n---\n**Claim.** d\n`);
  const { records, problems } = loadRecords(path.join(dir, "knowledge"), dir);
  assert.deepEqual(problems, []);
  const index = buildIndex(records);
  assert.deepEqual(index.records.map((r) => [r.id, r.terms]), [["claim/d", []], ["concept/c", ["footprint", "shape", "allocation"]]]);
  fs.rmSync(dir, { recursive: true, force: true });
});
