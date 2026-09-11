#!/usr/bin/env node
/**
 * Standalone validator for the LMS-content repo (root layout: topics/, paths/,
 * glossary/<pathId>.json, plus staging/). Runs in this repo's CI — the automated
 * gate of the staging → prod pipeline — without the application. Mirrors the
 * app's content rules (frontmatter, graph integrity, quiz indices, glossary).
 *
 * Glossaries are **per path** (glossary/<pathId>.json). A topic's <Term>s must
 * resolve in its *effective* glossary: the union of the glossaries of the paths
 * that contain the topic, or — for a topic in no path — the union of all
 * glossaries. Simulation `<Simulation id>` refs are checked against
 * simulations/packages. Usage:
 *
 *   node pipeline/validate.mjs            # validate prod (topics/ + paths/)
 *   node pipeline/validate.mjs --staging  # also validate staging/topics/**
 */
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter.mjs";
import { effectiveGlossary, loadGlossaries, pathsByTopic as indexPathsByTopic, termKeys } from "./glossary.mjs";

const ROOT = process.cwd();
const includeStaging = process.argv.includes("--staging");
const errors = [];
const warnings = [];

// Per-path glossaries: glossary/<name>.json → { name: { term: entry } } (see ./glossary.mjs).
const glossaries = loadGlossaries(path.join(ROOT, "glossary"));

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name.endsWith(".mdx") ? [full] : [];
  });
}

// Simulation ids available in this repo (one dir per sim under simulations/packages).
const SIMS_DIR = path.join(ROOT, "simulations", "packages");
const simIds = new Set(
  fs.existsSync(SIMS_DIR)
    ? fs
        .readdirSync(SIMS_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(SIMS_DIR, e.name, "sim.config.json")))
        .map((e) => e.name)
    : [],
);

// Parse a file's frontmatter (YAML only). A file that can't be parsed is reported
// as a validation error and skipped, rather than crashing the run.
function parsed(file) {
  try {
    return parseFrontmatter(fs.readFileSync(file, "utf8"), path.relative(ROOT, file));
  } catch (e) {
    errors.push(e.message);
    return null;
  }
}

// Collect topic ids from a topics dir, rooted for id derivation.
function topicsFrom(dir) {
  return walk(dir).flatMap((file) => {
    const id = path.relative(dir, file).replace(/\.mdx$/, "").split(path.sep).join("/");
    const fm = parsed(file);
    return fm ? [{ id, file, data: fm.data, content: fm.content }] : [];
  });
}

const prod = topicsFrom(path.join(ROOT, "topics"));
const staging = includeStaging ? topicsFrom(path.join(ROOT, "staging", "topics")) : [];
const topics = [...prod, ...staging];
const ids = new Set(topics.map((t) => t.id));

// Parse paths up front: validate them and build topic → set(pathId).
const pathFiles = walk(path.join(ROOT, "paths"));
const parsedPaths = pathFiles.flatMap((file) => {
  const fm = parsed(file);
  return fm ? [{ pid: path.basename(file, ".mdx"), data: fm.data }] : [];
});
// A topic's <Term>s resolve in its paths' glossaries, or in all of them if it's in no path.
const pathsByTopic = indexPathsByTopic(parsedPaths);

for (const t of topics) {
  const { id, data, content } = t;
  for (const f of ["title", "summary", "difficulty", "estimatedMinutes", "tags"]) {
    if (data[f] === undefined) errors.push(`${id}: missing required field "${f}"`);
  }
  if (data.difficulty !== undefined && !["beginner", "intermediate", "advanced"].includes(data.difficulty))
    errors.push(`${id}: difficulty "${data.difficulty}" must be beginner|intermediate|advanced`);
  if (data.status !== undefined && !["draft", "published"].includes(data.status))
    errors.push(`${id}: status "${data.status}" must be draft|published`);
  if (data.estimatedMinutes !== undefined && (!Number.isInteger(data.estimatedMinutes) || data.estimatedMinutes <= 0))
    errors.push(`${id}: estimatedMinutes must be a positive integer`);
  if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.length === 0))
    errors.push(`${id}: tags must be a non-empty array`);
  if (data.level !== undefined && (!Number.isInteger(data.level) || data.level <= 0))
    errors.push(`${id}: level must be a positive integer`);

  for (const p of data.prerequisites ?? [])
    if (!ids.has(p)) errors.push(`${id}: prerequisite "${p}" does not exist`);
  for (const r of data.relatedTo ?? [])
    if (!ids.has(r)) errors.push(`${id}: relatedTo "${r}" does not exist`);

  (data.quiz ?? []).forEach((q, i) => {
    if (!Array.isArray(q.choices) || q.choices.length < 2) errors.push(`${id}: quiz[${i}] needs ≥2 choices`);
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length)
      errors.push(`${id}: quiz[${i}] answer ${q.answer} out of range`);
  });

  const gloss = effectiveGlossary(id, glossaries, pathsByTopic);
  for (const key of termKeys(content)) {
    if (!gloss[key]) {
      const pids = pathsByTopic.get(id);
      const where = pids ? `the glossary of its path(s): ${[...pids].join(", ")}` : "any path glossary";
      errors.push(`${id}: glossary term "${key}" is not defined in ${where}`);
    }
  }
  for (const m of content.matchAll(/<Simulation[^>]*\bid=(["'])(.*?)\1/g)) {
    if (!simIds.has(m[2])) errors.push(`${id}: simulation "${m[2]}" has no simulations/packages/${m[2]}`);
  }
}

// Paths: required fields + every level's topic ids must resolve. A *draft* path
// may list topics that aren't written yet (warn) — it's under construction; a
// *published* path must resolve every topic (error).
for (const { pid, data } of parsedPaths) {
  for (const f of ["title", "summary", "levels"]) {
    if (data[f] === undefined) errors.push(`path ${pid}: missing "${f}"`);
  }
  const draft = data.status === "draft";
  for (const lvl of data.levels ?? [])
    for (const tid of lvl.topics ?? [])
      if (!ids.has(tid)) {
        const msg = `path ${pid}: topic "${tid}" (level ${lvl.level}) does not exist`;
        if (draft) warnings.push(`${msg} — not written yet (draft path)`);
        else errors.push(msg);
      }
}

// Resources: resources/<pathId>.json — supplementary materials per path.
const RES_DIR = path.join(ROOT, "resources");
const RES_TYPES = ["video", "prompt", "notebook", "link"];
let resourceFiles = 0;
if (fs.existsSync(RES_DIR)) {
  for (const f of fs.readdirSync(RES_DIR).filter((x) => x.endsWith(".json"))) {
    const pid = f.replace(/\.json$/, "");
    resourceFiles += 1;
    let items;
    try {
      items = JSON.parse(fs.readFileSync(path.join(RES_DIR, f), "utf8"));
    } catch (e) {
      errors.push(`resources ${pid}: invalid JSON (${e.message})`);
      continue;
    }
    if (!Array.isArray(items)) {
      errors.push(`resources ${pid}: must be a JSON array`);
      continue;
    }
    items.forEach((r, i) => {
      const at = `resources ${pid}[${i}]`;
      if (!r || typeof r !== "object") return errors.push(`${at}: must be an object`);
      if (!RES_TYPES.includes(r.type))
        errors.push(`${at}: type "${r.type}" must be ${RES_TYPES.join("|")}`);
      if (!r.title) errors.push(`${at}: missing "title"`);
      if (r.topic && !ids.has(r.topic)) errors.push(`${at}: topic "${r.topic}" does not exist`);
      if (r.type === "video" && !r.youtubeId) errors.push(`${at}: video needs "youtubeId"`);
      if (r.type === "prompt" && !r.prompt) errors.push(`${at}: prompt needs "prompt"`);
      if ((r.type === "notebook" || r.type === "link") && !r.url)
        errors.push(`${at}: ${r.type} needs "url"`);
    });
  }
}

if (warnings.length) {
  console.warn(`⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.warn(`  - ${w}`);
}
if (errors.length) {
  console.error(`✗ content validation failed — ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `✓ valid — ${prod.length} prod topic(s)${includeStaging ? ` + ${staging.length} staged` : ""}, ${parsedPaths.length} path(s), ${Object.keys(glossaries).length} glossary file(s), ${resourceFiles} resource file(s).`,
);
