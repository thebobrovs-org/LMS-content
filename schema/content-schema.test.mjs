// Tests for schema/content-schema.mjs (LMS-content#73): the one schema every
// consumer reads, with the baseline review's fixtures as negative cases. Run by
// `npm run gate`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  DIFFICULTIES, GlossarySchema, MDX_COMPONENTS, PathFrontmatterSchema, ResourcesSchema, SCHEMA_VERSION, STATUSES, SimConfigSchema,
  TopicFrontmatterSchema, check, isCalendarDate,
} from "./content-schema.mjs";

const topic = {
  title: "Arrays",
  summary: "Contiguous memory, O(1) index.",
  tags: ["fundamentals"],
  difficulty: "beginner",
  estimatedMinutes: 8,
  level: 100,
  prerequisites: [],
  relatedTo: ["data-structures/hash-tables"],
  videos: [{ youtubeId: "abc123", start: 30 }],
  flashcards: [{ front: "Index cost", back: "O(1)" }],
  quiz: [{ question: "Cost?", choices: ["O(1)", "O(n)"], answer: 0, explanation: "Arithmetic on the base." }],
  status: "published",
  updated: "2026-09-11",
  authors: ["ok"],
};

test("a well-formed topic parses, with defaults filled in", () => {
  const r = check(TopicFrontmatterSchema, topic, "t.mdx");
  assert.deepEqual(r.problems, []);
  const minimal = check(TopicFrontmatterSchema, { title: "T", summary: "S", tags: ["x"], difficulty: "beginner", estimatedMinutes: 1 });
  assert.equal(minimal.ok, true);
  assert.deepEqual([minimal.value.status, minimal.value.quiz, minimal.value.authors], ["published", [], []]);
  assert.equal(SCHEMA_VERSION, 1);
});

test("the baseline review's fixtures all fail", () => {
  const bad = {
    "a numeric title": { ...topic, title: 42 },
    "a video without youtubeId": { ...topic, videos: [{ title: "Intro" }] },
    "a flashcard without back": { ...topic, flashcards: [{ front: "only" }] },
    "an unquoted date (YAML gives a Date)": { ...topic, updated: new Date("2026-09-11") },
    "a frontmatter id overriding the path-derived id": { ...topic, id: "other/topic" },
    "an unknown key (a typo of an optional field)": { ...topic, estimatedMinute: 5 },
    "a quiz answer out of range": { ...topic, quiz: [{ question: "Q", choices: ["a", "b"], answer: 2 }] },
    "a quiz with one choice": { ...topic, quiz: [{ question: "Q", choices: ["a"], answer: 0 }] },
    "an empty tag list": { ...topic, tags: [] },
    "a difficulty outside the enum": { ...topic, difficulty: "hard" },
    "a status outside the enum": { ...topic, status: "review" },
    "a relatedTo id that isn't kebab-case": { ...topic, relatedTo: ["Data Structures/Hash Tables"] },
    "estimatedMinutes as a string": { ...topic, estimatedMinutes: "8" },
  };
  for (const [name, value] of Object.entries(bad)) {
    const r = check(TopicFrontmatterSchema, value, "t.mdx");
    assert.equal(r.ok, false, name);
    assert.ok(r.problems.every((p) => p.startsWith("t.mdx: ")), name);
  }
  assert.deepEqual(check(TopicFrontmatterSchema, { ...topic, id: "x" }, "t.mdx").problems, ["t.mdx: Unrecognized key(s) in object: 'id'"]);
  assert.match(check(TopicFrontmatterSchema, { ...topic, updated: new Date(0) }).problems[0], /updated: .*quoted YYYY-MM-DD/);
});

test("a path names published-shaped levels; a malformed one fails", () => {
  const path = { title: "P", summary: "S", levels: [{ level: 100, title: "Basics", topics: ["fundamentals/arrays"] }] };
  assert.equal(check(PathFrontmatterSchema, path).ok, true);
  assert.equal(check(PathFrontmatterSchema, { ...path, status: "draft" }).value.status, "draft");
  for (const bad of [
    { ...path, levels: [] },
    { ...path, levels: [{ level: 100, title: "B", topics: [] }] },
    { ...path, levels: [{ level: "100", title: "B", topics: ["a/b"] }] },
    { ...path, id: "p" },
    { ...path, levels: [{ level: 100, title: "B", topics: ["a/b"], extra: 1 }] },
  ]) {
    assert.equal(check(PathFrontmatterSchema, bad).ok, false, JSON.stringify(bad));
  }
});

test("glossary entries, resources and sim configs are checked too", () => {
  assert.equal(check(GlossarySchema, { array: { definition: "A block", href: "https://example.com", linkLabel: "more" } }).ok, true);
  assert.equal(check(GlossarySchema, { array: { definition: "" } }).ok, false);
  assert.equal(check(GlossarySchema, { array: { definition: "x", href: "not a url" } }).ok, false);
  assert.equal(check(GlossarySchema, { array: { definition: "x", see: "y" } }).ok, false);

  const resources = [
    { type: "video", title: "Intro", topic: "fundamentals/arrays", youtubeId: "abc" },
    { type: "prompt", title: "Quiz me", prompt: "Ask me three questions." },
    { type: "notebook", title: "NotebookLM", url: "https://notebooklm.google.com/x" },
    { type: "link", title: "Docs", url: "https://example.com", note: "official" },
  ];
  assert.equal(check(ResourcesSchema, resources).ok, true);
  for (const bad of [
    [{ type: "video", title: "no id" }],
    [{ type: "prompt", title: "no prompt" }],
    [{ type: "link", title: "bad url", url: "example.com" }],
    [{ type: "podcast", title: "unknown type", url: "https://example.com" }],
    [{ type: "prompt", title: "T", prompt: "P", url: "https://example.com" }],
    { type: "prompt", title: "not a list", prompt: "P" },
  ]) {
    assert.equal(check(ResourcesSchema, bad).ok, false, JSON.stringify(bad));
  }

  const sim = { id: "backprop-explorer", title: "Backprop", version: "1.2.0", props: {}, checkpoints: [{ id: "run", hint: "Press run" }] };
  assert.equal(check(SimConfigSchema, sim).ok, true);
  assert.deepEqual(check(SimConfigSchema, { id: "x", title: "X", version: "0.1.0" }).value.checkpoints, []);
  // A checkpoint may carry the ids it had before (LMS#62); they must be former ids, and distinct.
  const renamed = (renamedFrom) => ({ ...sim, checkpoints: [{ id: "observe-x", hint: "h", renamedFrom }] });
  assert.equal(check(SimConfigSchema, renamed(["quest-1", "quest-2"])).ok, true);
  assert.equal(check(SimConfigSchema, renamed([])).ok, true);
  for (const bad of [["observe-x"], ["quest-1", "quest-1"], [""], "quest-1"]) assert.equal(check(SimConfigSchema, renamed(bad)).ok, false, JSON.stringify(bad));
  for (const bad of [
    { ...sim, version: "1.2" },
    { ...sim, id: "Backprop Explorer" },
    { ...sim, checkpoints: [{ hint: "no id" }] },
    { ...sim, title: "" },
    { ...sim, bundle: "index.html" },
    "not an object",
  ]) {
    assert.equal(check(SimConfigSchema, bad).ok, false, JSON.stringify(bad));
  }
});

test("problems name the file, the path and the message, and check never throws", () => {
  const r = check(TopicFrontmatterSchema, { title: 1, summary: "", tags: [] }, "topics/x/y.mdx");
  assert.ok(r.problems.length >= 3);
  for (const p of r.problems) assert.match(p, /^topics\/x\/y\.mdx: [a-zA-Z.0-9]+: /);
  assert.equal(check(TopicFrontmatterSchema, null, "n.mdx").ok, false);
  assert.equal(check(TopicFrontmatterSchema, undefined, "n.mdx").ok, false);
  // A refinement or transform that throws is a problem, not an exception.
  const throwing = TopicFrontmatterSchema.refine(() => {
    throw new Error("refinement failure");
  });
  assert.deepEqual(check(throwing, topic, "t.mdx"), { ok: false, value: null, problems: ["t.mdx: validation threw: refinement failure"] });
  const transforming = z.string().transform(() => {
    throw new Error("transform failure");
  });
  assert.equal(check(transforming, "x").ok, false);
});

test("a date must be a real calendar day, not only shaped like one", () => {
  for (const good of ["2026-09-11", "2024-02-29", "2000-02-29", "1999-12-31", "0099-01-01", "0004-02-29"]) assert.equal(isCalendarDate(good), true, good);
  for (const bad of ["2026-99-99", "2026-02-30", "2023-02-29", "1900-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "0099-02-29", "26-09-11", "2026-9-11"]) {
    assert.equal(isCalendarDate(bad), false, bad);
    assert.equal(check(TopicFrontmatterSchema, { ...topic, updated: bad }).ok, false, bad);
  }
  assert.equal(check(TopicFrontmatterSchema, { ...topic, updated: "2024-02-29" }).ok, true);
});

test("the enum tuples and the MDX component list are the contract's literals", () => {
  assert.deepEqual(STATUSES, ["draft", "published"]);
  assert.deepEqual(DIFFICULTIES, ["beginner", "intermediate", "advanced"]);
  assert.deepEqual(MDX_COMPONENTS, ["YouTube", "Callout", "Simulation", "Flashcard", "Quiz", "Steps", "Step", "Figure", "Tip", "Term"]);
});
