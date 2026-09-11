// Tests for pipeline/promote.mjs (LMS-content#62), run by `npm run gate`. The CLI cases
// run the real promote.mjs (and the real validate.mjs it calls) against a small
// throwaway repo, so nothing here touches this checkout's content.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { publish } from "./promote.mjs";

const PROMOTE = fileURLToPath(new URL("./promote.mjs", import.meta.url));

const topic = (extra = "", body = "# Body\n") =>
  `---\ntitle: T\nsummary: S\ndifficulty: beginner\nestimatedMinutes: 5\ntags: [x]\n${extra}---\n${body}`;

/**
 * A throwaway repo at <private temp dir>/repo: `files` maps relative paths to contents.
 * Returns its root. The private parent lets a test check that nothing escapes the repo.
 */
function fixture(files) {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "promote-")), "repo");
  fs.mkdirSync(root);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}
const promote = (root, ...args) => spawnSync(process.execPath, [PROMOTE, ...args], { cwd: root, encoding: "utf8" });
const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (root, rel) => fs.existsSync(path.join(root, rel));

test("publish sets the status inside the frontmatter only", () => {
  const out = publish(topic("status: draft\n", "Some prose.\nstatus: draft\nmore\n"));
  assert.match(out, /^---\n[\s\S]*^status: published$[\s\S]*^---$/m);
  assert.ok(out.endsWith("Some prose.\nstatus: draft\nmore\n"), "a body line that starts with status: is left alone");
  assert.equal((out.match(/^status:/gm) ?? []).length, 2);
});

test("publish adds a status when the frontmatter has none, and keeps CRLF files CRLF", () => {
  assert.match(publish(topic()), /^tags: \[x\]\nstatus: published\n---\n/m);
  const crlf = publish(topic("status: draft\n").replace(/\n/g, "\r\n"));
  assert.match(crlf, /\r\nstatus: published\r\n---\r\n/);
  assert.doesNotMatch(crlf.replace(/\r\n/g, ""), /\n/);
});

test("publish refuses a file without frontmatter at the top", () => {
  assert.throws(() => publish("# no frontmatter\nstatus: draft\n", "x.mdx"), /x\.mdx: no YAML frontmatter/);
});

test("a staged topic is promoted: moved to topics/, published, and removed from staging", () => {
  const root = fixture({ "staging/topics/sub/a.mdx": topic("status: draft\n") });
  const r = promote(root, "staging/topics/sub/a.mdx");
  assert.equal(r.status, 0, r.stderr);
  assert.match(read(root, "topics/sub/a.mdx"), /^status: published$/m);
  assert.equal(exists(root, "staging/topics/sub/a.mdx"), false);
});

test("a path outside staging/topics is refused and nothing is written or deleted", () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "outside-"));
  fs.writeFileSync(path.join(outside, "x.mdx"), topic());
  const root = fixture({ "topics/x/prod.mdx": topic("status: published\n"), "staging/topics/ok.mdx": topic() });
  fs.symlinkSync(path.join(outside, "x.mdx"), path.join(root, "staging/topics/link.mdx"));
  for (const arg of ["topics/x/prod.mdx", "staging/../topics/x/prod.mdx", path.join(outside, "x.mdx"), "staging/topics/link.mdx", "staging/topics/../../topics/x/prod.mdx"]) {
    const r = promote(root, arg);
    assert.equal(r.status, 1, arg);
    assert.match(r.stderr, /only files inside staging\/topics\/ can be promoted/, arg);
  }
  assert.equal(read(root, "topics/x/prod.mdx"), topic("status: published\n"), "the published topic is untouched");
  assert.ok(fs.existsSync(path.join(outside, "x.mdx")), "the file outside the repo is untouched");
  assert.deepEqual(fs.readdirSync(path.dirname(root)), ["repo"], "nothing is written next to the repo");
});

test("an existing published topic is not overwritten without --force", () => {
  const root = fixture({ "topics/sub/a.mdx": topic("status: published\n", "old\n"), "staging/topics/sub/a.mdx": topic("status: draft\n", "new\n") });
  const refused = promote(root, "staging/topics/sub/a.mdx");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /topics\/sub\/a\.mdx already exists: pass --force/);
  assert.ok(read(root, "topics/sub/a.mdx").endsWith("old\n"));
  assert.ok(exists(root, "staging/topics/sub/a.mdx"), "the staged file stays");

  const forced = promote(root, "staging/topics/sub/a.mdx", "--force");
  assert.equal(forced.status, 0, forced.stderr);
  assert.ok(read(root, "topics/sub/a.mdx").endsWith("new\n"));
});

test("with --all, one blocked file stops the whole batch", () => {
  const root = fixture({
    "topics/sub/b.mdx": topic("status: published\n"),
    "staging/topics/sub/a.mdx": topic(),
    "staging/topics/sub/b.mdx": topic(),
  });
  const r = promote(root, "--all");
  assert.equal(r.status, 1);
  assert.equal(exists(root, "topics/sub/a.mdx"), false, "a.mdx isn't promoted when b.mdx is blocked");
  assert.ok(exists(root, "staging/topics/sub/a.mdx"));
});

test("validation runs first: an invalid staged topic means nothing moves", () => {
  const root = fixture({
    "staging/topics/sub/a.mdx": topic(),
    "staging/topics/sub/bad.mdx": "---\ntitle: No summary\ndifficulty: beginner\nestimatedMinutes: 5\ntags: [x]\n---\nbody\n",
  });
  const r = promote(root, "staging/topics/sub/a.mdx");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Validation failed, so nothing was promoted/);
  assert.match(r.stderr, /sub\/bad: missing required field "summary"/);
  assert.equal(exists(root, "topics/sub/a.mdx"), false);
  assert.ok(exists(root, "staging/topics/sub/a.mdx"));
});
