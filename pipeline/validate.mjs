#!/usr/bin/env node
/**
 * The content gate for this repo (root layout: topics/, paths/, glossary/<pathId>.json,
 * resources/<pathId>.json, simulations/packages/<id>/, media/, plus staging/). It runs
 * in CI, the automated gate of the staging → prod pipeline, without the application.
 *
 * Every file is checked against the one content schema (schema/content-schema.mjs,
 * ADR 0001 in the hub), which the app build and the admin editor use too, and then
 * for what a schema can't say: links between files, glossary terms, simulation ids,
 * media files, and that every .mdx compiles with the compiler the app uses.
 *
 * Glossaries are **per path** (glossary/<pathId>.json). A topic's <Term>s must
 * resolve in its *effective* glossary: the union of the glossaries of the paths
 * that contain the topic, or, for a topic in no path, the union of all glossaries.
 *
 *   node pipeline/validate.mjs            # validate prod (topics/ + paths/)
 *   node pipeline/validate.mjs --staging  # also validate staging/topics/** as a separate tree
 */
import fs from "node:fs";
import path from "node:path";
import { compile } from "@mdx-js/mdx";
import { parseFrontmatter } from "./frontmatter.mjs";
import { effectiveGlossary, pathsByTopic as indexPathsByTopic, termKeys } from "./glossary.mjs";
import {
  GlossarySchema, PathFrontmatterSchema, ResourcesSchema, SimConfigSchema, TopicFrontmatterSchema, check,
} from "../schema/content-schema.mjs";

const ROOT = process.cwd();
const includeStaging = process.argv.includes("--staging");
const errors = [];
const warnings = [];
const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");

function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, ext);
    return e.name.endsWith(ext) ? [full] : [];
  });
}

/** JSON from `file`, or null after recording the parse error. */
function json(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push(`${rel(file)}: invalid JSON (${e.message})`);
    return null;
  }
}

// ── simulations: sim.config.json against the schema; the id must match its directory ──
const SIMS_DIR = path.join(ROOT, "simulations", "packages");
const simIds = new Set();
if (fs.existsSync(SIMS_DIR)) {
  for (const e of fs.readdirSync(SIMS_DIR, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = path.join(SIMS_DIR, e.name, "sim.config.json");
    if (!fs.existsSync(file)) {
      errors.push(`simulations/packages/${e.name}: no sim.config.json`);
      continue;
    }
    const raw = json(file);
    if (raw === null) continue;
    const r = check(SimConfigSchema, raw, rel(file));
    errors.push(...r.problems);
    if (r.ok && r.value.id !== e.name) errors.push(`${rel(file)}: id "${r.value.id}" must equal the directory name "${e.name}"`);
    if (r.ok) simIds.add(e.name);
  }
}

// ── glossaries: glossary/<pathId>.json against the schema; only the valid ones are used for the term checks ──
const GLOSS_DIR = path.join(ROOT, "glossary");
const glossaries = {};
for (const file of walk(GLOSS_DIR, ".json")) {
  const raw = json(file);
  if (raw === null) continue;
  const r = check(GlossarySchema, raw, rel(file));
  errors.push(...r.problems);
  if (r.ok) glossaries[path.basename(file, ".json")] = r.value;
}

// ── topics and paths: frontmatter against the schema, then the file-level checks ──
// Parse a file's frontmatter (YAML only). A file that can't be parsed is reported
// as a validation error and skipped, rather than crashing the run.
function parsed(file) {
  try {
    return parseFrontmatter(fs.readFileSync(file, "utf8"), rel(file));
  } catch (e) {
    errors.push(e.message);
    return null;
  }
}

/** The topics under `dir`, each validated; the id is derived from the path, never from the frontmatter. */
function topicsFrom(dir, tree) {
  return walk(dir, ".mdx").flatMap((file) => {
    const id = path.relative(dir, file).replace(/\.mdx$/, "").split(path.sep).join("/");
    const fm = parsed(file);
    if (!fm) return [];
    const r = check(TopicFrontmatterSchema, fm.data, rel(file));
    errors.push(...r.problems);
    return r.ok ? [{ id, file, tree, data: r.value, content: fm.content }] : [];
  });
}

const prod = topicsFrom(path.join(ROOT, "topics"), "prod");
const staging = includeStaging ? topicsFrom(path.join(ROOT, "staging", "topics"), "staging") : [];
const topics = [...prod, ...staging];
const prodIds = new Map(prod.map((t) => [t.id, t]));
const ids = new Set(topics.map((t) => t.id));
for (const t of staging) if (prodIds.has(t.id)) errors.push(`${rel(t.file)}: a staged topic can't have the id of a published one ("${t.id}")`);

// Paths: validated up front, so the glossary check knows which paths hold a topic.
const parsedPaths = walk(path.join(ROOT, "paths"), ".mdx").flatMap((file) => {
  const fm = parsed(file);
  if (!fm) return [];
  const r = check(PathFrontmatterSchema, fm.data, rel(file));
  errors.push(...r.problems);
  return r.ok ? [{ pid: path.basename(file, ".mdx"), file, data: r.value, content: fm.content }] : [];
});
const pathsByTopic = indexPathsByTopic(parsedPaths);

// Media referenced by the content must exist under media/ (the app serves it from /media).
const MEDIA_DIR = path.join(ROOT, "media");
const mediaRefs = (content) => [...content.matchAll(/(?:\]\(|src=["'])\/media\/([^)"'\s]+)/g)].map((m) => m[1]);

/** Compile one MDX document as the app would; a failure names the file and line. */
async function compiles(file, source) {
  try {
    await compile(source, { development: false });
    return true;
  } catch (e) {
    const where = e.line ? `:${e.line}${e.column ? `:${e.column}` : ""}` : "";
    errors.push(`${rel(file)}${where}: MDX doesn't compile: ${e.reason ?? e.message}`);
    return false;
  }
}

for (const t of topics) {
  const { id, file, data, content } = t;
  for (const p of data.prerequisites) if (!ids.has(p)) errors.push(`${id}: prerequisite "${p}" does not exist`);
  for (const r of data.relatedTo) if (!ids.has(r)) errors.push(`${id}: relatedTo "${r}" does not exist`);

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
  for (const ref of mediaRefs(content)) {
    if (!fs.existsSync(path.join(MEDIA_DIR, ref))) errors.push(`${id}: media "/media/${ref}" has no media/${ref}`);
  }
  await compiles(file, content);
}

// Paths: every level's topic must be a published topic. A *draft* path may list
// topics that aren't written yet (warn); a *published* path may list only published,
// non-draft topics (error). A staged topic is never listed: it isn't built.
for (const { pid, file, data, content } of parsedPaths) {
  const draft = data.status === "draft";
  for (const lvl of data.levels) {
    for (const tid of lvl.topics) {
      const topic = prodIds.get(tid);
      if (!topic) {
        const staged = staging.some((t) => t.id === tid);
        const msg = `path ${pid}: topic "${tid}" (level ${lvl.level}) ${staged ? "is staged, not published" : "does not exist"}`;
        if (draft && !staged) warnings.push(`${msg} — not written yet (draft path)`);
        else errors.push(msg);
      } else if (!draft && topic.data.status === "draft") {
        errors.push(`path ${pid}: topic "${tid}" (level ${lvl.level}) is a draft, and this path is published`);
      }
    }
  }
  await compiles(file, content);
}

// Resources: resources/<pathId>.json against the schema; a resource's topic must exist.
const RES_DIR = path.join(ROOT, "resources");
let resourceFiles = 0;
for (const file of walk(RES_DIR, ".json")) {
  resourceFiles += 1;
  const raw = json(file);
  if (raw === null) continue;
  const r = check(ResourcesSchema, raw, rel(file));
  errors.push(...r.problems);
  if (!r.ok) continue;
  r.value.forEach((item, i) => {
    if (item.topic && !prodIds.has(item.topic)) errors.push(`${rel(file)}[${i}]: topic "${item.topic}" does not exist`);
  });
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
  `✓ valid — ${prod.length} prod topic(s)${includeStaging ? ` + ${staging.length} staged` : ""}, ${parsedPaths.length} path(s), ${Object.keys(glossaries).length} glossary file(s), ${resourceFiles} resource file(s), ${simIds.size} simulation(s); every .mdx compiles.`,
);
