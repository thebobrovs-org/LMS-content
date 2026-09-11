#!/usr/bin/env node
/**
 * Promote staged content to production. Moves staging/topics/<…>.mdx →
 * topics/<…>.mdx and sets `status: published` in its frontmatter. The final gate of
 * the staging → prod pipeline (run after human + sub-agent audit approves a draft).
 *
 *   node pipeline/promote.mjs staging/topics/ml-systems/foo.mdx [more…]
 *   node pipeline/promote.mjs --all       # promote every staged topic
 *   add --force to replace a topic that is already published
 *
 * It changes nothing unless every step can succeed (LMS-content#62):
 * - Only .mdx files inside staging/topics/ are accepted. staging/ and staging/topics/
 *   must be real directories in the repo, and every destination must stay inside the
 *   real topics/ directory: a symlink anywhere on the way is refused. Nothing outside
 *   the repo is read, written or deleted.
 * - An existing topic is never overwritten without --force, even one that appears
 *   while this runs: a new topic is linked into place, which fails if the name exists.
 * - Production content, as it will be after the promotion, must pass validate.mjs.
 *   That's checked in a scratch copy before anything in the repo changes.
 * - status is rewritten only inside the frontmatter.
 * - If a write fails midway, every file already moved is put back.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "./frontmatter.mjs";

/**
 * `text` with `status: published` in its frontmatter: an existing top-level status line
 * is replaced, or one is added. The body is never touched. Throws if there is no
 * frontmatter block at the top, or if the result doesn't parse as published.
 */
export function publish(text, file = "(input)") {
  const m = text.match(/^(---\r?\n)((?:[\s\S]*?\r?\n)?)(---(?:\r?\n|$))/);
  if (!m) throw new Error(`${file}: no YAML frontmatter block at the top of the file`);
  const [whole, open, fm, close] = m;
  const eol = open.endsWith("\r\n") ? "\r\n" : "\n";
  const next = /^status:.*$/m.test(fm) ? fm.replace(/^status:.*$/m, "status: published") : `${fm}status: published${eol}`;
  const out = open + next + close + text.slice(whole.length);
  if (parseFrontmatter(out, file).data.status !== "published") throw new Error(`${file}: could not set status: published`);
  return out;
}

const isLink = (p) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

/** Whether `child` is strictly inside `parent`. A name like "..notes" is fine; a ".." segment isn't. */
const inside = (parent, child) => {
  const rel = path.relative(parent, child);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};

/**
 * Why staging/topics/ can't serve as the boundary for sources, or null. It and staging/
 * must be real directories inside the repo: if either were a symlink, files outside the
 * repo would pass the containment check and be read and deleted.
 */
function stagingProblem(root) {
  for (const rel of ["staging", "staging/topics"]) {
    if (isLink(path.join(root, rel))) return `${rel}/ must be a real directory inside the repo, not a symlink`;
  }
  const stage = path.join(root, "staging", "topics");
  if (fs.existsSync(stage) && fs.realpathSync(stage) !== path.join(fs.realpathSync(root), "staging", "topics")) {
    return "staging/topics/ must be a real directory inside the repo";
  }
  return null;
}

/**
 * Why writing `dest` could reach outside the repo's topics/ directory, or null.
 * topics/ must be a real directory in the repo, and neither any directory between it
 * and the file nor the file itself may be a symlink (even a dangling one).
 */
function destinationProblem(root, dest) {
  const topics = path.join(root, "topics");
  const shown = (p) => path.relative(root, p);
  if (isLink(topics) || (fs.existsSync(topics) && fs.realpathSync(topics) !== path.join(fs.realpathSync(root), "topics"))) {
    return "topics/ must be a real directory inside the repo";
  }
  for (let dir = path.dirname(dest); dir !== topics; dir = path.dirname(dir)) {
    if (isLink(dir)) return `${shown(dir)} is a symlink`;
    if (fs.existsSync(dir) && !fs.statSync(dir).isDirectory()) return `${shown(dir)} is not a directory`;
  }
  if (isLink(dest)) return `${shown(dest)} is a symlink`;
  if (fs.existsSync(dest) && !fs.statSync(dest).isFile()) return `${shown(dest)} is not a file`;
  return null;
}

/**
 * Work out every move before making any. Returns { moves: [{ src, dest, rel, shown }], problems }.
 * `root` is the repo root; `args` are the command-line arguments.
 */
export function plan(root, args) {
  const force = args.includes("--force");
  const all = args.includes("--all");
  const names = args.filter((a) => !a.startsWith("--"));
  const stage = path.join(root, "staging", "topics");
  const problems = [];
  if (!all && names.length === 0) problems.push("Usage: node pipeline/promote.mjs <staging/topics/…mdx>… | --all  [--force]");
  const badStaging = stagingProblem(root);
  if (badStaging) return { moves: [], problems: [...problems, badStaging] };

  const stageReal = fs.existsSync(stage) ? fs.realpathSync(stage) : null;
  const walk = (dir) =>
    fs.existsSync(dir)
      ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const full = path.join(dir, e.name);
          return e.isDirectory() ? walk(full) : e.name.endsWith(".mdx") ? [full] : [];
        })
      : [];
  const candidates = all ? walk(stage) : names.map((n) => path.resolve(root, n));

  const moves = [];
  for (const src of candidates) {
    const shown = path.relative(root, src) || src;
    if (!fs.existsSync(src)) { problems.push(`${shown}: not found`); continue; }
    const real = fs.realpathSync(src);
    if (!stageReal || !inside(stageReal, real)) {
      problems.push(`${shown}: only files inside staging/topics/ can be promoted`);
      continue;
    }
    const rel = path.relative(stageReal, real);
    if (!rel.endsWith(".mdx") || !fs.statSync(real).isFile()) { problems.push(`${shown}: not an .mdx file`); continue; }
    const dest = path.join(root, "topics", rel);
    const unsafe = destinationProblem(root, dest);
    if (unsafe) { problems.push(`${shown}: ${unsafe}`); continue; }
    if (fs.existsSync(dest) && !force) {
      problems.push(`${path.relative(root, dest)} already exists: pass --force to replace the published topic`);
      continue;
    }
    moves.push({ src: real, dest, rel, shown: path.relative(root, dest) });
  }
  const dests = moves.map((m) => m.dest);
  if (new Set(dests).size !== dests.length) problems.push("two files would be promoted to the same topic");
  return { moves, problems };
}

/** Copy the files under `from` into `to`. Directories are created fresh, so the copy is always writable. */
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyTree(a, b);
    else if (e.isFile()) fs.copyFileSync(a, b);
  }
}

/**
 * Whether production content, as it will be after these moves, passes validate.mjs.
 * Checked in a scratch copy, so a prerequisite left behind in staging, or a broken
 * promoted topic, is caught before the repo changes. Other drafts don't count.
 */
function validateProjection(root, prepared) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "promote-check-"));
  try {
    for (const dir of ["topics", "paths", "glossary", "resources"]) {
      if (fs.existsSync(path.join(root, dir))) copyTree(path.join(root, dir), path.join(scratch, dir));
    }
    const sims = path.join(root, "simulations");
    if (fs.existsSync(sims)) fs.symlinkSync(fs.realpathSync(sims), path.join(scratch, "simulations"), "dir");
    for (const { rel, text } of prepared) {
      const target = path.join(scratch, "topics", rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
    }
    const validator = fileURLToPath(new URL("./validate.mjs", import.meta.url));
    return spawnSync(process.execPath, [validator], { cwd: scratch, stdio: "inherit" }).status === 0;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Put every prepared file in place, then remove the staged originals.
 * - Each file is first written, every byte of it, to a temporary name beside its
 *   destination. The name is opened exclusively, and its cleanup is registered before
 *   anything is written to it.
 * - A new topic is then hard-linked into place, which fails if something appeared at
 *   that name meanwhile. Without --force, an existing name is refused.
 * - A --force replacement keeps a hard-link backup of the published file. The backup is
 *   deleted only once the whole promotion has succeeded, or once the original is back.
 * If any step fails, every completed step is undone, newest first, and the error is
 * rethrown. If an undo step fails too, the error lists it in `error.unrecovered`, and a
 * backup that couldn't be put back is kept and named there. `io` is the fs module (tests
 * pass one with a failing step). Returns the staged files that couldn't be removed after
 * a successful promotion.
 */
export function commit(prepared, force, io = fs) {
  const undo = []; // { what, run }, oldest first
  const tag = `.promote-${process.pid}`;
  // Only what this attempt creates is ever cleaned up, even if `prepared` is reused for a retry.
  for (const m of prepared) {
    m.backup = null;
    m.replaced = false;
  }
  try {
    for (const m of prepared) {
      io.mkdirSync(path.dirname(m.dest), { recursive: true });
      const tmp = `${m.dest}${tag}.tmp`;
      const fd = io.openSync(tmp, "wx");
      undo.push({ what: `remove ${path.basename(tmp)}`, run: () => io.rmSync(tmp, { force: true }) });
      try {
        // writeSync may write fewer bytes than asked for: keep going until every byte is written.
        const bytes = Buffer.from(m.text, "utf8");
        for (let written = 0; written < bytes.length; ) {
          const n = io.writeSync(fd, bytes, written, bytes.length - written);
          if (!(n > 0)) throw new Error(`${m.shown}: writing the temporary file made no progress`);
          written += n;
        }
      } finally {
        io.closeSync(fd);
      }
      if (io.existsSync(m.dest)) {
        if (!force) throw new Error(`${m.shown}: appeared while promoting; pass --force to replace it`);
        const backup = `${m.dest}${tag}.bak`;
        io.linkSync(m.dest, backup); // EEXIST if that name is taken: never touch a backup this attempt didn't make
        m.backup = backup; // ours from here on: the original, until the promotion succeeds
        io.renameSync(tmp, m.dest);
        m.replaced = true; // from here on, only the backup holds the original
        undo.push({
          what: `restore ${m.shown}`,
          run: () => {
            io.renameSync(m.backup, m.dest);
            m.backup = null;
          },
        });
      } else {
        io.linkSync(tmp, m.dest); // fails with EEXIST if the name was taken meanwhile
        undo.push({ what: `remove ${m.shown}`, run: () => io.rmSync(m.dest, { force: true }) });
        io.rmSync(tmp);
      }
    }
  } catch (e) {
    const unrecovered = [];
    for (const step of undo.reverse()) {
      try {
        step.run();
      } catch (err) {
        unrecovered.push(`${step.what}: ${err.message}`);
      }
    }
    for (const m of prepared) {
      if (!m.backup) continue;
      // Replaced and not restored: the backup is the only copy of the original, so keep it.
      if (m.replaced) unrecovered.push(`${m.shown}: the original published file is kept at ${m.backup}`);
      else io.rmSync(m.backup, { force: true }); // never replaced, so the original is still in place
    }
    if (unrecovered.length) {
      e.unrecovered = unrecovered;
      e.message += `\nCouldn't undo everything:\n${unrecovered.map((u) => `  - ${u}`).join("\n")}`;
    }
    throw e;
  }
  const stale = [];
  for (const m of prepared) {
    if (m.backup) io.rmSync(m.backup, { force: true });
    try {
      io.rmSync(m.src);
    } catch {
      stale.push(m.src);
    }
  }
  return stale;
}

function main() {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const { moves, problems } = plan(root, args);
  if (problems.length) {
    for (const p of problems) console.error(`✗ ${p}`);
    console.error("Nothing was promoted.");
    return 1;
  }
  if (moves.length === 0) {
    console.log("Nothing to promote.");
    return 0;
  }
  // Prepare every file's new text before touching the tree, so a bad file stops the run.
  let prepared;
  try {
    prepared = moves.map((m) => ({ ...m, text: publish(fs.readFileSync(m.src, "utf8"), path.relative(root, m.src)) }));
  } catch (e) {
    console.error(`✗ ${e.message}\nNothing was promoted.`);
    return 1;
  }
  if (!validateProjection(root, prepared)) {
    console.error("✗ Production content wouldn't pass validation after this promotion, so nothing was promoted. Fix the problems above and try again.");
    return 1;
  }
  let stale;
  try {
    stale = commit(prepared, args.includes("--force"));
  } catch (e) {
    console.error(`✗ ${e.message}`);
    console.error(e.unrecovered ? "Recover the files listed above by hand." : "Nothing was promoted: the files already moved were put back.");
    return 1;
  }
  for (const { rel } of prepared) console.log(`promoted ${rel}  (staging → topics, status: published)`);
  if (stale.length) {
    console.error(`✗ Promoted, but couldn't remove the staged copies: ${stale.map((s) => path.relative(root, s)).join(", ")}. Delete them by hand.`);
    return 1;
  }
  console.log("Done. Commit the change and open a PR.");
  return 0;
}

// Run as a command, not when imported by the tests.
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
