#!/usr/bin/env node
/**
 * Fast per-file validator for one topic or path .mdx. Layout-aware: works in the
 * LMS-content repo (root `topics/`, `paths/`, `glossary/<pathId>.json`) and in the app
 * repo (`content/topics`, `content/paths`, `content/glossary`). For a repo-wide check use
 * `pipeline/validate.mjs` (content repo) or `npm run validate-content` (app repo).
 *
 *   node skills/lms-authoring-topics/scripts/validate.mjs topics/x/y.mdx
 *
 * <Term>s resolve in the topic's per-path glossary: the same rule as the repo-wide
 * validator, from pipeline/glossary.mjs (LMS-content#63).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../../../pipeline/frontmatter.mjs";
import { effectiveGlossary, loadGlossaries, pathsByTopic, termKeys } from "../../../pipeline/glossary.mjs";

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name.endsWith(".mdx") ? [full] : [];
  });
}

/** Where content lives: at the root in the content repo, under content/ in the app repo. */
function layout(root) {
  const base = fs.existsSync(path.join(root, "topics")) ? root : path.join(root, "content");
  return {
    topics: path.join(base, "topics"),
    staging: path.join(root, "staging", "topics"),
    paths: path.join(base, "paths"),
    glossary: path.join(base, "glossary"),
    legacyGlossary: path.join(base, "glossary.json"), // before per-path glossaries
    registry: path.join(root, "content", "simulations", "registry.json"), // app repo only
  };
}

const idIn = (dir, file) => path.relative(dir, file).replace(/\.mdx$/, "").split(path.sep).join("/");

/** The problems with one topic or path file, as messages (empty when it's valid). `root` is the repo root. */
export function validateFile(target, root = process.cwd()) {
  root = path.resolve(root); // a relative root must still recognise staging/topics/
  const dirs = layout(root);
  const file = path.resolve(root, target);
  const topicIds = new Set(walk(dirs.topics).map((f) => idIn(dirs.topics, f)));
  const glossaries = loadGlossaries(dirs.glossary);
  // Before per-path glossaries there was one glossary.json. If that's all there is, every
  // topic uses it, whichever paths list the topic.
  const legacy =
    Object.keys(glossaries).length === 0 && fs.existsSync(dirs.legacyGlossary)
      ? JSON.parse(fs.readFileSync(dirs.legacyGlossary, "utf8"))
      : null;
  // A path that doesn't parse leaves it unknown which glossaries apply; see the term check below.
  const pathProblems = [];
  const paths = walk(dirs.paths).flatMap((f) => {
    try {
      return [{ pid: path.basename(f, ".mdx"), data: parseFrontmatter(fs.readFileSync(f, "utf8"), path.relative(root, f)).data }];
    } catch (e) {
      pathProblems.push(e.message);
      return [];
    }
  });
  const byTopic = pathsByTopic(paths);
  const registry = fs.existsSync(dirs.registry) ? JSON.parse(fs.readFileSync(dirs.registry, "utf8")) : null;

  let data, content;
  try {
    ({ data, content } = parseFrontmatter(fs.readFileSync(file, "utf8"), target));
  } catch (e) {
    return [e.message];
  }
  const errors = [];
  const isPath = file.replace(/\\/g, "/").match(/\/(content\/)?paths\//);

  if (isPath) {
    for (const f of ["title", "summary", "levels"]) if (data[f] === undefined) errors.push(`missing "${f}"`);
    for (const [i, lvl] of (data.levels ?? []).entries()) {
      if (!Array.isArray(lvl.topics) || !lvl.topics.length) errors.push(`levels[${i}] needs ≥1 topic`);
      for (const tid of lvl.topics ?? []) if (!topicIds.has(tid)) errors.push(`levels[${i}]: topic "${tid}" does not exist`);
    }
    return errors;
  }

  const id = file.startsWith(dirs.staging + path.sep) ? idIn(dirs.staging, file) : idIn(dirs.topics, file);
  topicIds.add(id);
  for (const f of ["title", "summary", "tags", "difficulty", "estimatedMinutes"])
    if (data[f] === undefined) errors.push(`missing required field "${f}"`);
  if (data.difficulty && !["beginner", "intermediate", "advanced"].includes(data.difficulty))
    errors.push(`difficulty "${data.difficulty}" invalid`);
  if (data.estimatedMinutes !== undefined && (!Number.isInteger(data.estimatedMinutes) || data.estimatedMinutes <= 0))
    errors.push(`estimatedMinutes must be a positive integer`);
  if (data.tags !== undefined && (!Array.isArray(data.tags) || !data.tags.length))
    errors.push(`tags must be a non-empty array`);
  for (const p of data.prerequisites ?? []) if (!topicIds.has(p)) errors.push(`prerequisite "${p}" does not exist`);
  for (const r of data.relatedTo ?? []) if (!topicIds.has(r)) errors.push(`relatedTo "${r}" does not exist`);
  (data.quiz ?? []).forEach((q, i) => {
    if (!Array.isArray(q.choices) || q.choices.length < 2) errors.push(`quiz[${i}] needs ≥2 choices`);
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length)
      errors.push(`quiz[${i}] answer ${q.answer} out of range`);
  });
  const keys = termKeys(content);
  if (legacy) {
    for (const key of keys) if (!legacy[key]) errors.push(`glossary term "${key}" is not defined in glossary.json`);
  } else if (keys.length && pathProblems.length) {
    // Skipping the broken path could widen the search to every glossary and pass a term that shouldn't.
    errors.push(`can't check glossary terms: a path file couldn't be parsed, so it's unknown which glossaries apply (${pathProblems.join("; ")})`);
  } else {
    const gloss = effectiveGlossary(id, glossaries, byTopic);
    for (const key of keys) {
      if (!gloss[key]) {
        const pids = byTopic.get(id);
        const where = pids ? `the glossary of its path(s): ${[...pids].join(", ")}` : "any path glossary";
        errors.push(`glossary term "${key}" is not defined in ${where}`);
      }
    }
  }
  if (registry)
    for (const m of content.matchAll(/<Simulation[^>]*\bid=(["'])(.*?)\1/g))
      if (!registry[m[2]]) errors.push(`simulation "${m[2]}" is not in the registry`);
  return errors;
}

function main() {
  const target = process.argv[2];
  if (!target || !fs.existsSync(target)) {
    console.error("Usage: node …/validate.mjs <path-to-.mdx>");
    return 2;
  }
  const errors = validateFile(target);
  if (errors.length) {
    console.error(`✗ ${target} — ${errors.length} problem(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    return 1;
  }
  console.log(`✓ ${target} looks valid.`);
  return 0;
}

// Run as a command, not when imported by the tests.
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());
