// Tests for pipeline/validate.mjs (LMS-content#73): the gate rejects every fixture from
// the baseline review, MDX that doesn't compile or holds JavaScript, media outside
// media/, HTML that isn't prose, and a published path that lists a draft or staged topic; and it accepts a
// well-formed tree. Each case runs the real validator on a scratch content tree. Run
// by `npm run gate`.
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
/** Run and assert failure, returning the output. */
function fails(name, edits, ...args) {
  const r = run(tree(edits), ...args);
  assert.equal(r.code, 1, `${name} should fail:\n${r.out}`);
  assert.match(r.out, /content validation failed/, name);
  return r.out;
}

const fm = (patch) => TOPIC.replace(/^---\n([\s\S]*?)\n---/, (_, body) => `---\n${body}\n${patch}\n---`);
const withTitle = (title) => TOPIC.replace("title: Arrays", `title: ${title}`);

test("a well-formed tree passes, with and without staging", () => {
  const ok = run(tree());
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /every \.mdx compiles, with no JavaScript/);
  const staged = run(tree({ "staging/topics/fundamentals/lists.mdx": withTitle("Lists").replace("fundamentals/arrays", "x") }), "--staging");
  assert.equal(staged.code, 0, staged.out);
  // References that are fine: a fragment on a media URL, and an image example inside a code block.
  const fine = run(tree({ "topics/fundamentals/arrays.mdx": `${TOPIC}\n![d](/media/array.svg#diagram)\n\n\`\`\`md\n![x](/media/missing.svg)\n\`\`\`\n` }));
  assert.equal(fine.code, 0, fine.out);
});

test("learning objectives: a reference must name a declared objective; an unreferenced one warns (LMS-content#83)", () => {
  const OBJECTIVES = "objectives:\n  - id: index-cost\n    statement: Explain why indexed access is O(1).";
  const declared = fm(OBJECTIVES);
  // Five objectives, each referenced from exactly one location, so each location's reference is
  // known to count on its own: the frontmatter quiz, a frontmatter flashcard, an inline <Quiz>, an
  // inline <Flashcard> and a <Step>. Passes, with no unused warning.
  const five = ["fm-quiz", "fm-card", "inline-quiz", "inline-card", "step"].map((id) => `  - id: ${id}\n    statement: About ${id}.`).join("\n");
  const referenced =
    fm(`objectives:\n${five}\nquiz:\n  - question: Cost of a[i]?\n    choices: [O(1), O(n)]\n    answer: 0\n    objective: fm-quiz\nflashcards:\n  - front: F\n    back: B\n    objective: fm-card`) +
    '\n<Quiz objective="inline-quiz" question="Predict: a[1000]?" choices={["O(1)", "O(n)"]} answer={0} />\n\n<Flashcard objective="inline-card" front="F2" back="B2" />\n\n<Steps>\n<Step title="Find it" objective="step">Look.</Step>\n</Steps>\n';
  const ok = run(tree({ "topics/fundamentals/arrays.mdx": referenced }));
  assert.equal(ok.code, 0, ok.out);
  assert.doesNotMatch(ok.out, /declared but nothing/);
  // Drop one location's reference and only its objective is reported unused.
  const withoutStep = run(tree({ "topics/fundamentals/arrays.mdx": referenced.replace(' objective="step"', "") }));
  assert.equal(withoutStep.code, 0, withoutStep.out);
  assert.match(withoutStep.out, /objective "step" is declared but nothing practises or checks it/);
  assert.doesNotMatch(withoutStep.out, /"inline-card" is declared but nothing/);
  // Declared but never referenced: a warning, still valid.
  const unused = run(tree({ "topics/fundamentals/arrays.mdx": declared }));
  assert.equal(unused.code, 0, unused.out);
  assert.match(unused.out, /objective "index-cost" is declared but nothing practises or checks it/);
  // A reference to an objective the topic doesn't declare fails, wherever it is.
  const quizNowhere = fm("quiz:\n  - question: Q?\n    choices: [a, b]\n    answer: 0\n    objective: nowhere");
  fails("a quiz item naming an undeclared objective", { "topics/fundamentals/arrays.mdx": quizNowhere });
  fails("a flashcard naming an undeclared objective", { "topics/fundamentals/arrays.mdx": fm("flashcards:\n  - front: F\n    back: B\n    objective: nowhere") });
  fails("an inline Quiz naming an undeclared objective", { "topics/fundamentals/arrays.mdx": `${declared}\n<Quiz objective="nowhere" question="Q?" choices={["a", "b"]} answer={0} />\n` });
  fails("an inline Flashcard naming an undeclared objective", { "topics/fundamentals/arrays.mdx": `${declared}\n<Flashcard objective="nowhere" front="F" back="B" />\n` });
  // A path body has no objectives to refer to: an objective attribute there is refused, not ignored.
  fails("an objective attribute in a path body", { "paths/foundations.mdx": `${PATH_MDX}\n<Steps>\n<Step title="S" objective="nowhere">x</Step>\n</Steps>\n` });
  fails("a Step naming an undeclared objective", { "topics/fundamentals/arrays.mdx": `${declared}\n<Steps>\n<Step title="S" objective="nowhere">x</Step>\n</Steps>\n` });
  fails("an objective attribute that isn't a string", { "topics/fundamentals/arrays.mdx": `${declared}\n<Steps>\n<Step title="S" objective={1}>x</Step>\n</Steps>\n` });
  const r = run(tree({ "topics/fundamentals/arrays.mdx": quizNowhere }));
  assert.match(r.out, /quiz\[0\] names objective "nowhere", which the topic does not declare/);
});

test("stable ids (ADR 0004): unique within the topic, aliases never another item's; the body's ids count too", () => {
  const items = (patch) => fm(`flashcards:\n  - front: F1\n    back: B\n${patch}`);
  // Ids on items and steps, former ids listed, inline checks and steps with attributes: valid.
  const ok = run(tree({
    "topics/fundamentals/arrays.mdx":
      fm("flashcards:\n  - front: F1\n    back: B\n    id: front-one\n    formerIds: [abc123, old-name]\nquiz:\n  - question: Q1?\n    choices: [a, b]\n    answer: 0\n    id: q-one") +
      '\n<Quiz id="q-two" former-ids={["zz9"]} question="Q2?" choices={["a", "b"]} answer={0} />\n\n<Flashcard id="front-two" front="F2" back="B2" />\n\n<Steps>\n<Step title="S1" id="s-one" former-ids={["s1hash"]}>x</Step>\n<Step title="S2" id="front-one">y</Step>\n</Steps>\n',
  }));
  assert.equal(ok.code, 0, ok.out); // "front-one" is an item id and a step id: separate namespaces
  const dup = fails("two items with the same id", { "topics/fundamentals/arrays.mdx": items("    id: same\n  - front: F2\n    back: B\n    id: same") });
  assert.match(dup, /flashcards\[1\]: item id "same" is also flashcards\[0\]'s/);
  fails("an inline item reusing a frontmatter item's id", { "topics/fundamentals/arrays.mdx": items("    id: same") + '\n<Quiz id="same" question="Q?" choices={["a", "b"]} answer={0} />\n' });
  const stolen = fails("a former id that is another item's current id", { "topics/fundamentals/arrays.mdx": items("    id: keep\n  - front: F2\n    back: B\n    id: other\n    formerIds: [keep]") });
  assert.match(stolen, /flashcards\[1\]: former id "keep" is flashcards\[0\]'s current id/);
  fails("a former id claimed by two items", { "topics/fundamentals/arrays.mdx": items("    formerIds: [h1]\n  - front: F2\n    back: B\n    formerIds: [h1]") });
  fails("a former id that is the item's own id", { "topics/fundamentals/arrays.mdx": items("    id: me\n    formerIds: [me]") });
  fails("two steps with the same id", { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<Steps>\n<Step title="A" id="s">x</Step>\n<Step title="B" id="s">y</Step>\n</Steps>\n` });
  fails("a body id that isn't a slug", { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<Quiz id="Not A Slug" question="Q?" choices={["a", "b"]} answer={0} />\n` });
  fails("former-ids that isn't a string array", { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<Quiz former-ids="h1" question="Q?" choices={["a", "b"]} answer={0} />\n` });
  fails("a frontmatter id that isn't a slug", { "topics/fundamentals/arrays.mdx": items("    id: Not-A-Slug") });
});

test("--base <ref>: an item without an id whose prompt is new to the file gets a warning naming the vanished prompts' hashes", () => {
  const before = fm("flashcards:\n  - front: Old wording\n    back: B\n  - front: Kept\n    back: B\nquiz:\n  - question: Stable Q?\n    choices: [a, b]\n    answer: 0\n    id: stable");
  const after = fm("flashcards:\n  - front: New wording\n    back: B\n  - front: Kept\n    back: B\nquiz:\n  - question: Stable Q reworded?\n    choices: [a, b]\n    answer: 0\n    id: stable") + '\n<Steps>\n<Step title="A step">x</Step>\n</Steps>\n';
  const root = tree({ "topics/fundamentals/arrays.mdx": before });
  const git = (...args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "-q");
  git("-c", "user.email=t@example.com", "-c", "user.name=t", "add", "-A");
  git("-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "-m", "base");
  fs.writeFileSync(path.join(root, "topics/fundamentals/arrays.mdx"), after);
  const r = run(root, "--base", "HEAD");
  assert.equal(r.code, 0, r.out);
  // The reworded flashcard has no id: warned, with the vanished prompt's hash to list as a former id.
  assert.match(r.out, /item "New wording" has no id and its prompt is new to this file/);
  assert.match(r.out, /"Old wording" → [0-9a-z]+/);
  // The reworded quiz has an id: keyed by it, nothing to warn. The kept flashcard: nothing. The new step: warned (no id, new title), with no vanished step to point at.
  assert.doesNotMatch(r.out, /Stable Q reworded/);
  assert.doesNotMatch(r.out, /"Kept" has no id/);
  assert.match(r.out, /step "A step" has no id and its prompt is new to this file/);
  // Without --base, or when the file has no base version, no warning.
  const fresh = run(tree({ "topics/fundamentals/arrays.mdx": after }));
  assert.doesNotMatch(fresh.out, /has no id and its prompt is new/);
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
    // JSON null is a value the schema must see, not a parse failure to skip.
    "a resources file that is JSON null": { "resources/foundations.json": "null" },
    "a glossary file that is JSON null": { "glossary/foundations.json": "null" },
    "an unreferenced sim.config.json that is JSON null": { "simulations/packages/other-sim/sim.config.json": "null" },
    // A simulation id is read from the compiled tree, so every spelling of the attribute is checked.
    "a simulation that isn't packaged": { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<Simulation id="missing-sim" />\n` },
    "a simulation that isn't packaged, as a literal expression": { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<Simulation id={"missing-sim"} />\n` },
    "a simulation id that isn't a string": { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<Simulation id={42} />\n` },
    // A Callout type the app doesn't know renders as a plain note (LMS-content#61).
    "an unknown Callout type": { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<Callout type="warn">Careful.</Callout>\n` },
    "a Callout type that isn't a string": { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<Callout type={1}>Careful.</Callout>\n` },
  };
  for (const [name, edits] of Object.entries(cases)) fails(name, edits);
});

test("media must be a regular file inside media/, referenced from a topic or a path", () => {
  assert.match(fails("missing media in a path", { "paths/foundations.mdx": `${PATH_MDX}\n![m](/media/missing.svg)\n` }), /path foundations: media "\/media\/missing\.svg" has no media\/missing\.svg/);
  assert.match(fails("traversal", { "topics/fundamentals/arrays.mdx": `${TOPIC}\n![x](/media/../resources/foundations.json)\n` }), /points outside media\//);
  assert.match(fails("a directory", { "topics/fundamentals/arrays.mdx": `${TOPIC}\n![x](/media/dir)\n`, "media/dir/inner.svg": "<svg/>" }), /is not a file/);
  assert.match(fails("a reference-style image", { "topics/fundamentals/arrays.mdx": `${TOPIC}\n![x][img]\n\n[img]: /media/missing.svg\n` }), /has no media\/missing\.svg/);
  // References come from the compiled tree, so every spelling Markdown and JSX allow is seen.
  assert.match(fails("an angle-bracket destination", { "topics/fundamentals/arrays.mdx": `${TOPIC}\n![x](</media/missing.svg>)\n` }), /has no media\/missing\.svg/);
  assert.match(fails("a JSX src", { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<img src="/media/missing.svg" alt="x" />\n` }), /has no media\/missing\.svg/);
  assert.match(fails("a JSX src as a literal expression", { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<img src={"/media/missing.svg"} alt="x" />\n` }), /has no media\/missing\.svg/);
  assert.match(fails("a JSX src as a template", { "topics/fundamentals/arrays.mdx": `${TOPIC}\n<img src={\`/media/missing.svg\`} alt="x" />\n` }), /has no media\/missing\.svg/);
  // A symlink that escapes media/.
  const root = tree();
  fs.symlinkSync(path.join(root, "resources", "foundations.json"), path.join(root, "media", "escape.svg"));
  fs.appendFileSync(path.join(root, "topics/fundamentals/arrays.mdx"), "\n![x](/media/escape.svg)\n");
  const r = run(root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /points outside media\//);
});

test("a lesson is prose plus the documented components: no JavaScript, no other tags", () => {
  const cases = {
    "an expression": `${TOPIC}\nTwo is {1 + 1}.\n`,
    "a flow expression": `${TOPIC}\n{console.log("x")}\n`,
    "an import": `${TOPIC}\nimport x from "y"\n`,
    "an export": `${TOPIC}\nexport const y = 1\n`,
    "an undocumented component": `${TOPIC}\n<Script src="/x.js" />\n`,
    "an attribute that is code": `${TOPIC}\n<Simulation id={simId} />\n`,
    "an attribute with a function": `${TOPIC}\n<Simulation id="demo-sim" props={{ onLoad: () => 1 }} />\n`,
    "an attribute with a call": `${TOPIC}\n<Simulation id="demo-sim" height={Number("520")} />\n`,
    "a spread attribute": `${TOPIC}\n<Callout {...props} />\n`,
    "a template with a substitution": "${TOPIC}\n{`x${1}`}\n".replace("${TOPIC}", TOPIC),
  };
  for (const [name, body] of Object.entries(cases)) {
    const out = fails(name, { "topics/fundamentals/arrays.mdx": body });
    assert.match(out, /MDX rejected/, name);
  }
  // Documented components, prose HTML, and expressions that carry only literal data are fine.
  const ok = run(tree({
    "topics/fundamentals/arrays.mdx": `${TOPIC}\n<Callout type="tip">Hi <em>there</em>{" "}now</Callout>\n\n<Steps>\n  <Step title="One">Do it.</Step>\n</Steps>\n\n<Simulation id="demo-sim" height={520} props={{ keys: 24, replicas: -1, names: ["a", "b"], on: true, none: null }} />\n\n<details>\n  <summary>More</summary>\n  <img src="/media/array.svg" alt="memory" width={300} data-kind="diagram" />\n  <a href="https://example.org/spec#part" target="_blank" rel="noreferrer">the spec</a>, [a topic](/topics/fundamentals/arrays), <a href="mailto:hi@example.org">mail</a>.\n</details>\n`,
  }));
  assert.equal(ok.code, 0, ok.out);
});

test("a lesson's HTML is prose: no active elements, attributes or URL schemes", () => {
  const cases = {
    "an HTML string as a prop": [`${TOPIC}\n<div dangerouslySetInnerHTML={{ __html: "<img src=x onerror=alert(1)>" }} />\n`, /<div dangerouslySetInnerHTML>: a lesson's HTML may carry only/],
    "a script element": [`${TOPIC}\n<script>alert(1)</script>\n`, /<script> isn't HTML a lesson may write/],
    "an iframe with srcDoc": [`${TOPIC}\n<iframe srcDoc="<script>alert(1)</script>" />\n`, /<iframe> isn't HTML a lesson may write/],
    "an inline handler": [`${TOPIC}\n<a href="/x" onclick="alert(1)">x</a>\n`, /<a onclick>: a lesson's HTML may carry only/],
    "a style attribute": [`${TOPIC}\n<span style={{ color: "red" }}>x</span>\n`, /<span style>: a lesson's HTML may carry only/],
    "a javascript: href": [`${TOPIC}\n<a href="javascript:alert(1)">x</a>\n`, /<a href> may point at a same-site path, http\(s\) or mailto, not "javascript:"/],
    "a data: src": [`${TOPIC}\n<img src="data:text/html,<script>alert(1)</script>" alt="x" />\n`, /<img src> may point at .*, not "data:"/],
    "a javascript: Markdown link": [`${TOPIC}\n[x](javascript:alert(1))\n`, /a link may point at .*, not "javascript:"/],
    "a data: Markdown image": [`${TOPIC}\n![x](data:image/svg+xml,<svg/>)\n`, /an image may point at .*, not "data:"/],
    "a javascript: reference definition": [`${TOPIC}\n[x][j]\n\n[j]: javascript:alert(1)\n`, /an image may point at .*, not "javascript:"/],
    // A URL is a string however it is written, and a browser's normalization can't hide the scheme.
    "a javascript: href in a template": [`${TOPIC}\n<a href={\`javascript:alert(1)\`}>x</a>\n`, /<a href> may point at .*, not "javascript:"/],
    "an href that isn't a string": [`${TOPIC}\n<a href={["javascript:alert(1)"]}>x</a>\n`, /<a href=\{…\}> must be a string/],
    "a src that is a number": [`${TOPIC}\n<img src={1} alt="x" />\n`, /<img src=\{…\}> must be a string/],
    "a leading space before the scheme": [`${TOPIC}\n<a href=" javascript:alert(1)">x</a>\n`, /<a href> holds whitespace or a control character/],
    "a tab inside the scheme": [`${TOPIC}\n<a href={"java\\tscript:alert(1)"}>x</a>\n`, /<a href> holds whitespace or a control character/],
    "a newline inside the scheme": [`${TOPIC}\n<a href={"java\\nscript:alert(1)"}>x</a>\n`, /<a href> holds whitespace or a control character/],
    "a carriage return inside the scheme": [`${TOPIC}\n<a href={\`java\\rscript:alert(1)\`}>x</a>\n`, /<a href> holds whitespace or a control character/],
    "a trailing control character": [`${TOPIC}\n<img src={"/media/array.svg\\u0001"} alt="x" />\n`, /<img src> holds whitespace or a control character/],
  };
  for (const [name, [body, message]] of Object.entries(cases)) {
    const out = fails(name, { "topics/fundamentals/arrays.mdx": body });
    assert.match(out, /MDX rejected/, name);
    assert.match(out, message, name);
  }
});

test("an MDX error names the line in the file, not in the body", () => {
  // The frontmatter is 7 lines plus the closing ---, so the body starts at line 9; "<Unclosed>" lands on line 16.
  const body = `${TOPIC}\n<Unclosed>\n`;
  assert.equal(body.split("\n")[15], "<Unclosed>");
  const out = fails("an unclosed tag", { "topics/fundamentals/arrays.mdx": body });
  assert.match(out, /topics\/fundamentals\/arrays\.mdx:16:\d+: MDX rejected/);
});

test("a published path may list only published topics; a staged topic is never listed", () => {
  const draftTopic = TOPIC.replace("---\ntitle", "---\nstatus: draft\ntitle");
  assert.match(fails("a draft topic in a published path", { "topics/fundamentals/arrays.mdx": draftTopic }), /is a draft, and this path is published/);
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
  assert.match(fails("a staged topic in a path", staged, "--staging"), /is staged, not published/);
});

test("--staging can't repair a broken production link: a published topic links only to published topics", () => {
  const edits = {
    "topics/fundamentals/arrays.mdx": fm("prerequisites: [fundamentals/lists]"),
    "staging/topics/fundamentals/lists.mdx": withTitle("Lists"),
  };
  assert.match(fails("a prod prerequisite that is only staged", edits, "--staging"), /prerequisite "fundamentals\/lists" does not exist in production \(it is staged\)/);
  // A staged topic may link to a published one, or to another staged one.
  const ok = run(tree({ "staging/topics/fundamentals/lists.mdx": withTitle("Lists").replace("prerequisites: []", "").replace("---\ntitle", "---\nprerequisites: [fundamentals/arrays]\ntitle") }), "--staging");
  assert.equal(ok.code, 0, ok.out);
});

test("problems name the file, and a parse failure doesn't stop the run", () => {
  const out = fails("a non-YAML frontmatter and bad JSON", { "topics/fundamentals/arrays.mdx": TOPIC.replace("---\ntitle", "---js\ntitle"), "glossary/foundations.json": "{not json" });
  assert.match(out, /topics\/fundamentals\/arrays\.mdx: frontmatter must be YAML/);
  assert.match(out, /glossary\/foundations\.json: invalid JSON/);
});
