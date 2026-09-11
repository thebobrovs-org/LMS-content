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
 * It refuses, and changes nothing, unless every step can succeed (LMS-content#62):
 * - only .mdx files inside staging/topics/ are accepted (symlinks are resolved
 *   first, so nothing outside the repo is read, written or deleted);
 * - an existing topics/<…>.mdx is never overwritten without --force;
 * - `node pipeline/validate.mjs --staging` must pass before anything moves;
 * - status is rewritten only inside the frontmatter, never in the body.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
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

/**
 * Work out every move before making any. Returns { moves: [{ src, dest, rel }], problems }.
 * `root` is the repo root; `args` are the command-line arguments.
 */
export function plan(root, args) {
  const force = args.includes("--force");
  const all = args.includes("--all");
  const names = args.filter((a) => !a.startsWith("--"));
  const stage = path.join(root, "staging", "topics");
  const problems = [];
  if (!all && names.length === 0) problems.push("Usage: node pipeline/promote.mjs <staging/topics/…mdx>… | --all  [--force]");

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
    const rel = stageReal ? path.relative(stageReal, real) : "";
    if (!stageReal || !rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      problems.push(`${shown}: only files inside staging/topics/ can be promoted`);
      continue;
    }
    if (!rel.endsWith(".mdx") || !fs.statSync(real).isFile()) { problems.push(`${shown}: not an .mdx file`); continue; }
    const dest = path.join(root, "topics", rel);
    if (fs.existsSync(dest) && !force) {
      problems.push(`${path.relative(root, dest)} already exists: pass --force to replace the published topic`);
      continue;
    }
    moves.push({ src: real, dest, rel });
  }
  const dests = moves.map((m) => m.dest);
  if (new Set(dests).size !== dests.length) problems.push("two files would be promoted to the same topic");
  return { moves, problems };
}

/** Run the content validator on published + staged content, from `root`. */
function validate(root) {
  const validator = fileURLToPath(new URL("./validate.mjs", import.meta.url));
  return spawnSync(process.execPath, [validator, "--staging"], { cwd: root, stdio: "inherit" }).status === 0;
}

function main() {
  const root = process.cwd();
  const { moves, problems } = plan(root, process.argv.slice(2));
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
  if (!validate(root)) {
    console.error("✗ Validation failed, so nothing was promoted. Fix the problems above and try again.");
    return 1;
  }
  for (const { src, dest, rel, text } of prepared) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, text);
    fs.rmSync(src);
    console.log(`promoted ${rel}  (staging → topics, status: published)`);
  }
  console.log("Done. Commit the change and open a PR.");
  return 0;
}

// Run as a command, not when imported by the tests.
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
