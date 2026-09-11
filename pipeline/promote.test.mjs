// Tests for pipeline/promote.mjs (LMS-content#62), run by `npm run gate`. The CLI cases
// run the real promote.mjs (and the real validate.mjs it calls) against throwaway repos,
// so nothing here touches this checkout's content. commit() is tested directly, so races
// and failures can be arranged exactly.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { commit, publish } from "./promote.mjs";

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
/** Temporary or backup files commit() left behind under topics/. */
function leftovers(root) {
  const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [e.name])) : []);
  return walk(path.join(root, "topics")).filter((name) => /\.promote-\d+\.(tmp|bak)$/.test(name));
}

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
  assert.deepEqual(leftovers(root), []);
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

test("a staging/ or staging/topics/ that is a symlink is refused, and the files behind it stay put", () => {
  const cases = { staging: "topics/sub/a.mdx", "staging/topics": "sub/a.mdx" }; // the link, and where a.mdx sits behind it
  for (const [link, inner] of Object.entries(cases)) {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "outside-"));
    fs.mkdirSync(path.dirname(path.join(outside, inner)), { recursive: true });
    fs.writeFileSync(path.join(outside, inner), topic());
    const root = fixture({});
    fs.mkdirSync(path.dirname(path.join(root, link)), { recursive: true });
    fs.symlinkSync(outside, path.join(root, link));
    for (const args of [["--all"], ["staging/topics/sub/a.mdx"]]) {
      const r = promote(root, ...args);
      assert.equal(r.status, 1, `${link}: ${args}`);
      assert.match(r.stderr, new RegExp(`${link}/ must be a real directory inside the repo`), `${link}: ${args}`);
      assert.ok(fs.existsSync(path.join(outside, inner)), `${link}: the file behind the link stays`);
      assert.equal(exists(root, "topics/sub/a.mdx"), false);
    }
  }
});

test("a name that merely starts with two dots is an ordinary name", () => {
  const root = fixture({ "staging/topics/..notes/a.mdx": topic() });
  const r = promote(root, "staging/topics/..notes/a.mdx");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(exists(root, "topics/..notes/a.mdx"));
});

test("a destination reached through a symlink is refused, even with --force", () => {
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "outside-")), "target");
  fs.mkdirSync(outside);
  const arrangements = {
    "topics/ itself is a symlink": (root) => fs.symlinkSync(outside, path.join(root, "topics")),
    "a directory under topics/ is a symlink": (root) => {
      fs.mkdirSync(path.join(root, "topics"));
      fs.symlinkSync(outside, path.join(root, "topics/sub"));
    },
    "the destination file is a dangling symlink": (root) => {
      fs.mkdirSync(path.join(root, "topics/sub"), { recursive: true });
      fs.symlinkSync(path.join(outside, "a.mdx"), path.join(root, "topics/sub/a.mdx"));
    },
  };
  for (const [name, arrange] of Object.entries(arrangements)) {
    const root = fixture({ "staging/topics/sub/a.mdx": topic() });
    arrange(root);
    const r = promote(root, "staging/topics/sub/a.mdx", "--force");
    assert.equal(r.status, 1, name);
    assert.match(r.stderr, /is a symlink|must be a real directory/, name);
    assert.deepEqual(fs.readdirSync(outside), [], `${name}: nothing is written outside the repo`);
    assert.ok(exists(root, "staging/topics/sub/a.mdx"), `${name}: the staged file stays`);
  }
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
  assert.deepEqual(leftovers(root), []);
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

test("an invalid topic isn't promoted: production is validated as it would be", () => {
  const root = fixture({
    "staging/topics/sub/a.mdx": "---\ntitle: No summary\ndifficulty: beginner\nestimatedMinutes: 5\ntags: [x]\n---\nbody\n",
  });
  const r = promote(root, "staging/topics/sub/a.mdx");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /topics\/sub\/a\.mdx: summary: Required/); // the schema names the file, the field and the problem
  assert.match(r.stderr, /wouldn't pass validation after this promotion, so nothing was promoted/);
  assert.equal(exists(root, "topics/sub/a.mdx"), false);
  assert.ok(exists(root, "staging/topics/sub/a.mdx"));
});

test("a prerequisite still in staging blocks the promotion; promoting both works", () => {
  const root = fixture({
    "staging/topics/sub/a.mdx": topic("prerequisites: [sub/b]\n"),
    "staging/topics/sub/b.mdx": topic(),
  });
  const alone = promote(root, "staging/topics/sub/a.mdx");
  assert.equal(alone.status, 1);
  assert.match(alone.stderr, /prerequisite "sub\/b" does not exist/);
  assert.equal(exists(root, "topics/sub/a.mdx"), false);

  const both = promote(root, "--all");
  assert.equal(both.status, 0, both.stderr);
  assert.ok(exists(root, "topics/sub/a.mdx") && exists(root, "topics/sub/b.mdx"));
});

test("an unrelated broken draft doesn't block promoting a finished topic", () => {
  const root = fixture({ "staging/topics/sub/a.mdx": topic(), "staging/topics/sub/wip.mdx": "---\ntitle: Work in progress\n---\n" });
  const r = promote(root, "staging/topics/sub/a.mdx");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(exists(root, "topics/sub/a.mdx"));
});

/** commit() input for `[staged file, destination, text]` entries in `root`. */
const prepared = (root, entries) =>
  entries.map(([src, dest, text]) => ({ src: path.join(root, src), dest: path.join(root, dest), rel: dest, shown: dest, text }));

test("commit refuses a destination that appeared after planning, and keeps the staged file", () => {
  const root = fixture({ "staging/topics/sub/a.mdx": topic() });
  const moves = prepared(root, [["staging/topics/sub/a.mdx", "topics/sub/a.mdx", "new\n"]]);
  fs.mkdirSync(path.join(root, "topics/sub"), { recursive: true });
  fs.writeFileSync(path.join(root, "topics/sub/a.mdx"), "someone else's\n"); // created after planning
  assert.throws(() => commit(moves, false), /appeared while promoting/);
  assert.equal(read(root, "topics/sub/a.mdx"), "someone else's\n");
  assert.ok(exists(root, "staging/topics/sub/a.mdx"));
  assert.deepEqual(leftovers(root), []);
});

test("if a later write fails, the files already moved are put back", () => {
  const root = fixture({
    "staging/topics/sub/a.mdx": topic(),
    "staging/topics/sub/c.mdx": topic(),
    "staging/topics/sub/b.mdx": topic(),
    "topics/sub/c.mdx": "old c\n",
    "topics/blocked": "a file where a directory is needed\n",
  });
  const moves = prepared(root, [
    ["staging/topics/sub/a.mdx", "topics/sub/a.mdx", "new a\n"], // a new topic
    ["staging/topics/sub/c.mdx", "topics/sub/c.mdx", "new c\n"], // a --force replacement
    ["staging/topics/sub/b.mdx", "topics/blocked/b.mdx", "new b\n"], // fails: its directory is a file
  ]);
  assert.throws(() => commit(moves, true));
  assert.equal(exists(root, "topics/sub/a.mdx"), false, "the new topic is removed again");
  assert.equal(read(root, "topics/sub/c.mdx"), "old c\n", "the replaced topic is restored");
  for (const s of ["a", "b", "c"]) assert.ok(exists(root, `staging/topics/sub/${s}.mdx`), `staged ${s}.mdx is kept`);
  assert.deepEqual(leftovers(root), []);
});

test("if putting a replaced topic back fails, its original is kept and reported, never deleted", () => {
  const root = fixture({
    "staging/topics/sub/c.mdx": topic(),
    "staging/topics/sub/b.mdx": topic(),
    "topics/sub/c.mdx": "old c\n",
    "topics/blocked": "a file where a directory is needed\n",
  });
  const moves = prepared(root, [
    ["staging/topics/sub/c.mdx", "topics/sub/c.mdx", "new c\n"], // a --force replacement
    ["staging/topics/sub/b.mdx", "topics/blocked/b.mdx", "new b\n"], // fails, which starts the rollback
  ]);
  // Restoring from the backup fails; every other rename works.
  const io = { ...fs };
  io.renameSync = (from, to) => {
    if (from.endsWith(".bak")) throw new Error("simulated failure");
    return fs.renameSync(from, to);
  };
  let error;
  assert.throws(() => commit(moves, true, io), (e) => ((error = e), true));
  assert.match(error.message, /Couldn't undo everything/);
  const kept = error.unrecovered.find((u) => u.includes("is kept at"))?.split("is kept at ")[1];
  assert.ok(kept, `the backup is named in the error:\n${error.message}`);
  assert.equal(fs.readFileSync(kept, "utf8"), "old c\n", "the original's bytes are still recoverable");
});

test("a short write is finished: every byte of the topic is written before it's published", () => {
  const root = fixture({ "staging/topics/sub/a.mdx": topic() });
  const text = `${"x".repeat(10_000)}\nthe end, with a multibyte character: é\n`;
  const moves = prepared(root, [["staging/topics/sub/a.mdx", "topics/sub/a.mdx", text]]);
  // Writes at most 7 bytes per call, whatever it's asked for (a whole string, or a slice of a buffer).
  const io = { ...fs };
  io.writeSync = (fd, data, offset = 0, length) => {
    const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;
    const start = typeof data === "string" ? 0 : offset;
    const want = typeof data === "string" ? bytes.length : length;
    return fs.writeSync(fd, bytes, start, Math.min(want, 7));
  };
  commit(moves, false, io);
  assert.equal(read(root, "topics/sub/a.mdx"), text);
});

test("a backup this attempt didn't create is never deleted, even when the promotion fails", () => {
  const root = fixture({ "staging/topics/sub/c.mdx": topic(), "topics/sub/c.mdx": "published c\n" });
  // A backup kept by an earlier failed restore, under the name this process would use.
  const earlier = path.join(root, `topics/sub/c.mdx.promote-${process.pid}.bak`);
  fs.writeFileSync(earlier, "the original, kept by an earlier failed restore\n");
  const moves = prepared(root, [["staging/topics/sub/c.mdx", "topics/sub/c.mdx", "new c\n"]]);
  assert.throws(() => commit(moves, true), /EEXIST/);
  assert.equal(fs.readFileSync(earlier, "utf8"), "the original, kept by an earlier failed restore\n");
  assert.equal(read(root, "topics/sub/c.mdx"), "published c\n", "the published topic is untouched");
  assert.ok(exists(root, "staging/topics/sub/c.mdx"));
});

test("a temp file that fails partway through writing is removed on rollback", () => {
  const root = fixture({ "staging/topics/sub/a.mdx": topic(), "staging/topics/sub/b.mdx": topic() });
  const moves = prepared(root, [
    ["staging/topics/sub/a.mdx", "topics/sub/a.mdx", "new a\n"],
    ["staging/topics/sub/b.mdx", "topics/sub/b.mdx", "new b\n"],
  ]);
  let writes = 0;
  const io = { ...fs };
  io.writeSync = (...args) => {
    if (++writes === 2) throw new Error("simulated disk full"); // b's temp file exists, but its write fails
    return fs.writeSync(...args);
  };
  assert.throws(() => commit(moves, false, io), /simulated disk full/);
  assert.equal(exists(root, "topics/sub/a.mdx"), false, "the first topic is removed again");
  assert.deepEqual(leftovers(root), [], "the half-written temp file is gone");
  assert.ok(exists(root, "staging/topics/sub/a.mdx") && exists(root, "staging/topics/sub/b.mdx"));
});
