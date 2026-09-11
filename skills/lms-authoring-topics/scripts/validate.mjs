#!/usr/bin/env node
/**
 * Fast per-file validator for one topic or path .mdx. Layout-aware: works in the
 * LMS-content repo (root `topics/`, `paths/`, `glossary.json`) and in the app
 * repo (`content/topics`, …). For a repo-wide check use `pipeline/validate.mjs`
 * (content repo) or `npm run validate-content` (app repo).
 *
 *   node skills/lms-authoring-topics/scripts/validate.mjs topics/x/y.mdx
 */
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "../../../pipeline/frontmatter.mjs";

const ROOT = process.cwd();
const has = (p) => fs.existsSync(path.join(ROOT, p));

// Detect layout: content repo (root) vs app repo (content/).
const TOPICS_DIR = has("topics") ? path.join(ROOT, "topics") : path.join(ROOT, "content", "topics");
const GLOSSARY = has("glossary.json")
  ? path.join(ROOT, "glossary.json")
  : path.join(ROOT, "content", "glossary.json");
const REGISTRY = path.join(ROOT, "content", "simulations", "registry.json"); // app repo only

const target = process.argv[2];
if (!target || !fs.existsSync(target)) {
  console.error("Usage: node …/validate.mjs <path-to-.mdx>");
  process.exit(2);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name.endsWith(".mdx") ? [full] : [];
  });
}
const topicId = (file) =>
  path.relative(TOPICS_DIR, file).replace(/\.mdx$/, "").split(path.sep).join("/");

const topicIds = new Set(walk(TOPICS_DIR).map(topicId));
const glossary = fs.existsSync(GLOSSARY) ? JSON.parse(fs.readFileSync(GLOSSARY, "utf8")) : {};
const registry = fs.existsSync(REGISTRY) ? JSON.parse(fs.readFileSync(REGISTRY, "utf8")) : null;

let data, content;
try {
  ({ data, content } = parseFrontmatter(fs.readFileSync(target, "utf8"), target));
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
const errors = [];
const isPath = path.resolve(target).replace(/\\/g, "/").match(/\/(content\/)?paths\//);

if (isPath) {
  for (const f of ["title", "summary", "levels"]) if (data[f] === undefined) errors.push(`missing "${f}"`);
  for (const [i, lvl] of (data.levels ?? []).entries()) {
    if (!Array.isArray(lvl.topics) || !lvl.topics.length) errors.push(`levels[${i}] needs ≥1 topic`);
    for (const tid of lvl.topics ?? []) if (!topicIds.has(tid)) errors.push(`levels[${i}]: topic "${tid}" does not exist`);
  }
} else {
  const id = topicId(target);
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
  for (const m of content.matchAll(/<Term\b([^>]*)>([\s\S]*?)<\/Term>/g)) {
    const a = m[1].match(/\bid=["']([^"']+)["']/);
    const key = (a ? a[1] : m[2]).toLowerCase().trim();
    if (!glossary[key]) errors.push(`glossary term "${key}" is not defined`);
  }
  if (registry)
    for (const m of content.matchAll(/<Simulation[^>]*\bid=(["'])(.*?)\1/g))
      if (!registry[m[2]]) errors.push(`simulation "${m[2]}" is not in the registry`);
}

if (errors.length) {
  console.error(`✗ ${target} — ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ ${target} looks valid.`);
