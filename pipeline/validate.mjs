#!/usr/bin/env node
/**
 * The content gate for this repo (root layout: topics/, paths/, glossary/<pathId>.json,
 * resources/<pathId>.json, simulations/packages/<id>/, media/, plus staging/). It runs
 * in CI, the automated gate of the staging → prod pipeline, without the application.
 *
 * Every file is checked against the one content schema (schema/content-schema.mjs,
 * ADR 0001 in the hub), which the app build and the admin editor use too, and then
 * for what a schema can't say: links between files, glossary terms, simulation ids,
 * media files, and that every .mdx compiles with the compiler the app uses and holds
 * no JavaScript: no expressions, imports or exports, and no JSX tag outside
 * MDX_COMPONENTS.
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
import { spawnSync } from "node:child_process";
import { compile } from "@mdx-js/mdx";
import { itemHash, stepHash } from "./ids.mjs";
import { parseFrontmatter } from "./frontmatter.mjs";
import { effectiveGlossary, pathsByTopic as indexPathsByTopic, termKeys } from "./glossary.mjs";
import { loadRecords, recordProblems } from "./knowledge.mjs";
import { lessonRules } from "../schema/lesson-mdx.mjs";
import {
  GlossarySchema, CALLOUT_TYPES, MDX_COMPONENTS, PathFrontmatterSchema, ResourcesSchema, SimConfigSchema, TopicFrontmatterSchema, check,
} from "../schema/content-schema.mjs";

const ROOT = process.cwd();
const includeStaging = process.argv.includes("--staging");
/** `--base <ref>`: the git ref the changed topics are compared with for the prompt-change warning (ADR 0004); content CI passes the PR's base. */
const baseIdx = process.argv.indexOf("--base");
const baseRef = baseIdx > 0 ? (process.argv[baseIdx + 1] ?? null) : null;

const errors = [];
const warnings = [];
const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");

/** Whether `ref` names a commit here; a base that doesn't is an error, never a silent pass with every comparison skipped. */
function refExists(ref) {
  return spawnSync("git", ["rev-parse", "--verify", "-q", `${ref}^{commit}`], { cwd: ROOT, encoding: "utf8" }).status === 0;
}

/**
 * A topic's frontmatter and rendered identities at `ref` (`git show ref:path`): `{ data, identities }`,
 * `{ absent: true }` when the file isn't in that commit (a new topic: nothing to compare), or
 * `{ skipped: reason }` when it is there but can't be read as a topic (the caller reports it).
 */
async function topicAt(ref, file) {
  const r = spawnSync("git", ["show", `${ref}:${rel(file)}`], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) {
    if (/does not exist in|exists on disk, but not in/.test(r.stderr)) return { absent: true };
    return { skipped: `git show failed: ${r.stderr.trim() || `exit ${r.status}`}` };
  }
  try {
    const fm = parseFrontmatter(r.stdout, rel(file));
    const checked = check(TopicFrontmatterSchema, fm.data, rel(file));
    if (!checked.ok) return { skipped: "its frontmatter at the base does not match the schema" };
    const urls = [], sims = [], objectives = [], identities = [];
    await compile(fm.content, { development: false, remarkPlugins: [() => lessonRules(urls, sims, objectives, identities)] });
    return { data: checked.value, identities };
  } catch (e) {
    return { skipped: `its body at the base does not compile (${String(e.reason ?? e.message).split("\n")[0]})` };
  }
}
if (baseRef !== null && !refExists(baseRef)) errors.push(`--base ${baseRef}: not a commit in this repository`);

function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, ext);
    return e.name.endsWith(ext) ? [full] : [];
  });
}

/** The JSON in `file`, as { ok, value }: a parsed `null` is a value, and still goes to its schema. */
function json(file) {
  try {
    return { ok: true, value: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (e) {
    errors.push(`${rel(file)}: invalid JSON (${e.message})`);
    return { ok: false, value: null };
  }
}

// ── simulations: sim.config.json against the schema; the id must match its directory ──
const SIMS_DIR = path.join(ROOT, "simulations", "packages");
const simIds = new Set();
const simCheckpoints = new Map(); // sim id → every checkpoint id, former ids included (LMS#62), for the knowledge records' references
if (fs.existsSync(SIMS_DIR)) {
  for (const e of fs.readdirSync(SIMS_DIR, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const file = path.join(SIMS_DIR, e.name, "sim.config.json");
    if (!fs.existsSync(file)) {
      errors.push(`simulations/packages/${e.name}: no sim.config.json`);
      continue;
    }
    const raw = json(file);
    if (!raw.ok) continue;
    const r = check(SimConfigSchema, raw.value, rel(file));
    errors.push(...r.problems);
    if (r.ok && r.value.id !== e.name) errors.push(`${rel(file)}: id "${r.value.id}" must equal the directory name "${e.name}"`);
    if (r.ok) simIds.add(e.name);
    if (r.ok) simCheckpoints.set(e.name, new Set((r.value.checkpoints ?? []).flatMap((c) => [c.id, ...(c.renamedFrom ?? [])])));
  }
}

// ── glossaries: glossary/<pathId>.json against the schema; only the valid ones are used for the term checks ──
const GLOSS_DIR = path.join(ROOT, "glossary");
const glossaries = {};
for (const file of walk(GLOSS_DIR, ".json")) {
  const raw = json(file);
  if (!raw.ok) continue;
  const r = check(GlossarySchema, raw.value, rel(file));
  errors.push(...r.problems);
  if (r.ok) glossaries[path.basename(file, ".json")] = r.value;
}

// ── topics and paths: frontmatter against the schema, then the file-level checks ──
// Parse a file's frontmatter (YAML only). A file that can't be parsed is reported
// as a validation error and skipped, rather than crashing the run.
function parsed(file) {
  try {
    const src = fs.readFileSync(file, "utf8");
    const fm = parseFrontmatter(src, rel(file));
    // The body's first line, in the file: compiler positions are translated back to it.
    const bodyLine = src.split("\n").length - fm.content.split("\n").length + 1;
    return { ...fm, bodyLine };
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
    return r.ok ? [{ id, file, tree, data: r.value, content: fm.content, bodyLine: fm.bodyLine }] : [];
  });
}

const prod = topicsFrom(path.join(ROOT, "topics"), "prod");
const staging = includeStaging ? topicsFrom(path.join(ROOT, "staging", "topics"), "staging") : [];
const topics = [...prod, ...staging];
const prodIds = new Map(prod.map((t) => [t.id, t]));
const allIds = new Set(topics.map((t) => t.id));
for (const t of staging) if (prodIds.has(t.id)) errors.push(`${rel(t.file)}: a staged topic can't have the id of a published one ("${t.id}")`);

// Paths: validated up front, so the glossary check knows which paths hold a topic.
const parsedPaths = walk(path.join(ROOT, "paths"), ".mdx").flatMap((file) => {
  const fm = parsed(file);
  if (!fm) return [];
  const r = check(PathFrontmatterSchema, fm.data, rel(file));
  errors.push(...r.problems);
  return r.ok ? [{ pid: path.basename(file, ".mdx"), file, data: r.value, content: fm.content, bodyLine: fm.bodyLine }] : [];
});
const pathsByTopic = indexPathsByTopic(parsedPaths);

// ── media: every /media/... reference must be a regular file inside media/ ──
const MEDIA_DIR = path.join(ROOT, "media");
const MEDIA_REAL = fs.existsSync(MEDIA_DIR) ? fs.realpathSync(MEDIA_DIR) : null;

/** Why `/media/<ref>` isn't a regular file inside media/, or null if it is. */
function mediaProblem(ref) {
  const name = ref.replace(/^\/media\//, "");
  if (!MEDIA_REAL) return `media "${ref}" has no media/ directory`;
  let real;
  try {
    real = fs.realpathSync(path.resolve(MEDIA_DIR, name));
  } catch {
    return `media "${ref}" has no media/${name}`;
  }
  if (real !== MEDIA_REAL && !real.startsWith(MEDIA_REAL + path.sep)) return `media "${ref}" points outside media/`;
  if (!fs.statSync(real).isFile()) return `media "${ref}" is not a file`;
  return null;
}

// ── MDX: compiles as the app would, holds no JavaScript, and its media exist ──
// The lesson rules live in schema/lesson-mdx.mjs, shared with every consumer of lessons (hyperstack#114).
export { isLiteralData } from "../schema/lesson-mdx.mjs";

/** Compile one MDX body as the app would; a failure names the file and its line in the file. Returns the URLs, simulation ids and objective references it holds, or null. */
async function compiles(file, content, bodyLine) {
  const urls = [];
  const sims = [];
  const objectives = [];
  const identities = [];
  try {
    await compile(content, { development: false, remarkPlugins: [() => lessonRules(urls, sims, objectives, identities)] });
    return { urls, sims, objectives, identities };
  } catch (e) {
    // The position is in the message's body coordinates, as fields or as a "(line:col-line:col)" suffix.
    const reason = String(e.reason ?? e.message);
    const suffix = /\s*\((\d+):(\d+)(?:-\d+:\d+)?\)\s*$/.exec(reason);
    const line = e.line ?? e.place?.start?.line ?? (suffix ? Number(suffix[1]) : undefined);
    const column = e.column ?? e.place?.start?.column ?? (suffix ? Number(suffix[2]) : undefined);
    const where = line ? `:${line + bodyLine - 1}${column ? `:${column}` : ""}` : "";
    errors.push(`${rel(file)}${where}: MDX rejected: ${suffix ? reason.slice(0, suffix.index) : reason}`);
    return null;
  }
}

/** The /media/... files a document references, from the URLs its compiled tree holds; the file name is the pathname, not a fragment or query string. */
export const mediaRefs = (urls) => [...new Set(urls.filter((u) => u.startsWith("/media/")).map((u) => u.replace(/[#?].*$/, "")))];

/** The checks a topic or path body needs beyond its frontmatter: it compiles under the lesson rules, its media exist, and its simulations are packaged. Returns the objective ids the body references. */
async function checkBody(id, file, content, bodyLine) {
  const found = await compiles(file, content, bodyLine);
  for (const ref of mediaRefs(found?.urls ?? [])) {
    const problem = mediaProblem(ref);
    if (problem) errors.push(`${id}: ${problem}`);
  }
  for (const sim of new Set(found?.sims ?? [])) {
    if (!simIds.has(sim)) errors.push(`${id}: simulation "${sim}" has no simulations/packages/${sim}`);
  }
  return { objectives: found?.objectives ?? [], identities: found?.identities ?? [], sims: [...new Set(found?.sims ?? [])] };
}

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Stable ids (ADR 0004): every review item (the frontmatter's flashcards and quiz, the
 * body's <Quiz> and <Flashcard>) shares one namespace within the topic, and the steps
 * another. An item's current identity is its `id`, else the hash of its prompt (what the
 * app keys progress by), and every current identity must be unique: two ids, an id equal
 * to another item's hash, or two idless items with the same prompt all collide. A former
 * id must not be another item's current identity (explicit or hash), be claimed by two
 * items, or be the item's own id. Items are told apart by position, never by label: two
 * inline checks with the same prompt are two items. The body's ids are checked for shape
 * here (the schema checks the frontmatter's).
 */
export function identityProblems(data, bodyIdentities) {
  const body = (tag) => bodyIdentities.filter((b) => (tag === "Step") === (b.tag === "Step"));
  const items = [
    ...(data.flashcards ?? []).map((f, i) => ({ where: `flashcards[${i}]`, prompt: f.front, id: f.id, formerIds: f.formerIds ?? [] })),
    ...(data.quiz ?? []).map((q, i) => ({ where: `quiz[${i}]`, prompt: q.question, id: q.id, formerIds: q.formerIds ?? [] })),
    ...body("item").map((b, i) => ({ where: `body's ${nth(i + 1)} check <${b.tag} ${JSON.stringify(b.prompt ?? "")}>`, prompt: b.prompt, id: b.id, formerIds: b.formerIds })),
  ];
  const steps = body("Step").map((b, i) => ({ where: `body's ${nth(i + 1)} step <Step ${JSON.stringify(b.prompt ?? "")}>`, prompt: b.prompt, id: b.id, formerIds: b.formerIds }));
  const errors = [];
  for (const [namespace, list, hash] of [["item", items, itemHash], ["step", steps, stepHash]]) {
    const owners = new Map(); // current identity (id, or the prompt's hash) → the record
    for (const e of list) {
      for (const v of [e.id, ...e.formerIds]) if (v !== undefined && !ID_RE.test(v)) errors.push(`${e.where}: id "${v}" must be lowercase letters, digits and hyphens`);
      e.current = e.id ?? (e.prompt === undefined ? undefined : hash(e.prompt));
      if (e.current === undefined) continue;
      const other = owners.get(e.current);
      if (other) errors.push(`${e.where}: ${namespace} ${e.id === undefined ? "hash" : "id"} "${e.current}" is also ${other.where}'s${other.id === undefined ? " (its prompt's hash)" : ""}`);
      else owners.set(e.current, e);
    }
    // What each record claims as history: its listed former ids and, when it has an id, its prompt's
    // hash (the app treats that as a former id by itself, so giving an item an id keeps its history).
    // A claim on another record's current identity, or on the same history twice, is a conflict.
    const claimed = new Map(); // former id → the record
    for (const e of list) {
      // An id equal to the prompt's own hash freezes the current key as the stable id: nothing to claim.
      const implicit = e.id !== undefined && e.prompt !== undefined && hash(e.prompt) !== e.id ? hash(e.prompt) : undefined;
      const claims = [...e.formerIds.map((f) => ({ f, label: `former id "${f}"` })), ...(implicit === undefined ? [] : [{ f: implicit, label: `its prompt's hash "${implicit}" (a former id by itself, since it has an id)` }])];
      for (const { f, label } of claims) {
        const owner = owners.get(f);
        if (f === e.id) errors.push(`${e.where}: ${label} is its own id`);
        else if (owner && owner !== e) errors.push(`${e.where}: ${label} is ${owner.where}'s current ${owner.id === undefined ? "hash" : "id"}`);
        const first = claimed.get(f);
        if (first && first !== e) errors.push(`${e.where}: ${label} is also claimed by ${first.where}`);
        else claimed.set(f, e);
      }
    }
  }
  return errors;
}

const nth = (n) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/**
 * With `--base <ref>` (content CI: the PR's base branch), an item without an `id` whose
 * prompt is new to the file gets a warning: if it is a reworded item, its learners' history
 * is keyed by the old prompt's hash, which the warning names, so the author can give the
 * item an `id` and list that hash as a former id. Items with an id are keyed by it and
 * need nothing. A vanished item that had an id is named by that id: dropping the id and
 * rewording at once keys the history by the id, not by any hash.
 */
export function promptChangeWarnings(head, base) {
  const prompts = (t) => [
    ...(t.data.flashcards ?? []).map((f) => ({ prompt: f.front, id: f.id, kind: "item" })),
    ...(t.data.quiz ?? []).map((q) => ({ prompt: q.question, id: q.id, kind: "item" })),
    ...t.identities.filter((b) => b.prompt !== undefined).map((b) => ({ prompt: b.prompt, id: b.id, kind: b.tag === "Step" ? "step" : "item" })),
  ];
  const before = prompts(base);
  const now = prompts(head);
  const warnings = [];
  for (const kind of ["item", "step"]) {
    const old = before.filter((p) => p.kind === kind);
    const oldPrompts = new Set(old.map((p) => p.prompt));
    const gone = old.filter((p) => !now.some((n) => n.kind === kind && n.prompt === p.prompt));
    for (const n of now.filter((p) => p.kind === kind && p.id === undefined && !oldPrompts.has(p.prompt))) {
      const key = (g) => (g.id !== undefined ? `id ${g.id}` : `hash ${kind === "step" ? stepHash(g.prompt) : itemHash(g.prompt)}`);
      const hint = gone.length ? ` ${kind[0].toUpperCase()}${kind.slice(1)}s that vanished from this file and the keys their progress is stored under: ${gone.map((g) => `${JSON.stringify(g.prompt)} → ${key(g)}`).join("; ")}.` : "";
      warnings.push(`${kind} ${JSON.stringify(n.prompt)} has no id and its prompt is new to this file: if it is a reworded ${kind}, learners' progress is keyed by the old prompt's hash (or the id it had); give it an id and list that key in its former ids, or keep its old id.${hint}`);
    }
  }
  return warnings;
}

/**
 * Learning objectives (LMS-content#83): every `objective` a quiz item, a flashcard, an inline
 * <Quiz>/<Flashcard> or a <Step> names must be one of the topic's `objectives`; an objective
 * nothing references is a warning (it is stated but never practised or checked).
 */
export function objectiveProblems(data, bodyRefs) {
  const declared = new Set((data.objectives ?? []).map((o) => o.id));
  const refs = [
    ...(data.quiz ?? []).map((q, i) => ({ where: `quiz[${i}]`, id: q.objective })),
    ...(data.flashcards ?? []).map((f, i) => ({ where: `flashcards[${i}]`, id: f.objective })),
    ...bodyRefs.map((id) => ({ where: "the body", id })),
  ].filter((r) => r.id != null);
  const errors = refs.filter((r) => !declared.has(r.id)).map((r) => `${r.where} names objective "${r.id}", which the topic does not declare`);
  const used = new Set(refs.map((r) => r.id));
  const warnings = [...declared].filter((id) => !used.has(id)).map((id) => `objective "${id}" is declared but nothing practises or checks it`);
  return { errors, warnings };
}

// What each topic offers a knowledge record to touch (LMS-content#105): its objectives, and its items' and steps' current and former identities (ADR 0004).
const touchable = new Map();
for (const t of topics) {
  const { id, file, data, content, bodyLine, tree } = t;
  // A published topic may link only to published topics; a staged one to either.
  const resolves = (target) => (tree === "prod" ? prodIds.has(target) : allIds.has(target));
  for (const p of data.prerequisites) if (!resolves(p)) errors.push(`${id}: prerequisite "${p}" does not exist${tree === "prod" && allIds.has(p) ? " in production (it is staged)" : ""}`);
  for (const r of data.relatedTo) if (!resolves(r)) errors.push(`${id}: relatedTo "${r}" does not exist${tree === "prod" && allIds.has(r) ? " in production (it is staged)" : ""}`);

  const gloss = effectiveGlossary(id, glossaries, pathsByTopic);
  for (const key of termKeys(content)) {
    if (!gloss[key]) {
      const pids = pathsByTopic.get(id);
      const where = pids ? `the glossary of its path(s): ${[...pids].join(", ")}` : "any path glossary";
      errors.push(`${id}: glossary term "${key}" is not defined in ${where}`);
    }
  }
  const body = await checkBody(id, file, content, bodyLine);
  touchable.set(id, { ...touchableIn(data, body.identities, tree), sims: new Set(body.sims) });
  const objectives = objectiveProblems(data, body.objectives);
  for (const e of objectives.errors) errors.push(`${id}: ${e}`);
  for (const w of objectives.warnings) warnings.push(`${id}: ${w}`);
  for (const e of identityProblems(data, body.identities)) errors.push(`${id}: ${e}`);
  if (baseRef !== null && refExists(baseRef)) {
    const base = await topicAt(baseRef, file);
    if (base.skipped) warnings.push(`${id}: prompt changes not compared with ${baseRef}: ${base.skipped}`);
    else if (!base.absent) for (const w of promptChangeWarnings({ data, identities: body.identities }, base)) warnings.push(`${id}: ${w}`);
  }
}

// Paths: every level's topic must be a published topic. A *draft* path may list
// topics that aren't written yet (warn); a *published* path may list only published,
// non-draft topics (error). A staged topic is never listed: it isn't built.
for (const { pid, file, data, content, bodyLine } of parsedPaths) {
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
  // A path has no objectives to refer to (LMS-content#83): an objective attribute in its body is refused, not ignored.
  const pathBody = await checkBody(`path ${pid}`, file, content, bodyLine);
  for (const id of new Set(pathBody.objectives)) errors.push(`path ${pid}: the body names objective "${id}", but a path declares no objectives`);
}

// Knowledge records (knowledge/, LMS-content#105): the schema, and every `touches` reference resolved
// against what was just loaded: a topic, one of its objectives, an item or step under any identity it
// has had, a simulation or one of its checkpoints. A published lesson may depend only on records whose
// references resolve in production; a disputed record it depends on names the open issue.
export function touchableIn(data, identities, tree) {
  const items = new Set();
  const steps = new Set();
  const add = (set, prompt, id, formerIds, hash) => {
    if (id !== undefined) set.add(id);
    if (prompt !== undefined) set.add(hash(prompt));
    for (const f of formerIds ?? []) set.add(f);
  };
  for (const f of data.flashcards ?? []) add(items, f.front, f.id, f.formerIds, itemHash);
  for (const q of data.quiz ?? []) add(items, q.question, q.id, q.formerIds, itemHash);
  for (const b of identities) add(b.tag === "Step" ? steps : items, b.prompt, b.id, b.formerIds, b.tag === "Step" ? stepHash : itemHash);
  return { objectives: new Set((data.objectives ?? []).map((o) => o.id)), items, steps, tree };
}
/** Whether a topic is published: in production and not a draft. */
const isPublished = (tid) => touchable.get(tid)?.tree === "prod" && prodIds.get(tid)?.data.status !== "draft";
const resolveRef = (ref) => {
  const m = /^(?:(objective|item|step|sim|checkpoint|topic):)?(.+)$/.exec(ref);
  const kind = m[1] ?? "topic";
  const rest = m[2];
  const topicOf = (tid) => {
    const t = touchable.get(tid);
    if (!t) return { why: `names topic "${tid}", which does not exist${!includeStaging && fs.existsSync(path.join(ROOT, "staging", "topics", `${tid}.mdx`)) ? " in production (it is staged)" : ""}` };
    return { t };
  };
  if (kind === "topic") return touchable.has(rest) ? { ok: true } : { ok: false, why: topicOf(rest).why };
  if (kind === "sim") return simIds.has(rest) ? { ok: true } : { ok: false, why: `names simulation "${rest}", which has no simulations/packages/${rest}` };
  if (kind === "checkpoint") {
    const [sim, cp] = rest.split("/");
    if (!simIds.has(sim)) return { ok: false, why: `names simulation "${sim}", which has no simulations/packages/${sim}` };
    return simCheckpoints.get(sim)?.has(cp) ? { ok: true } : { ok: false, why: `names checkpoint "${cp}", which ${sim} does not declare (current or former)` };
  }
  const sep = kind === "step" ? ":" : "#";
  const i = rest.lastIndexOf(sep);
  const tid = rest.slice(0, i);
  const sub = rest.slice(i + 1);
  const { t, why } = topicOf(tid);
  if (!t) return { ok: false, why };
  const set = kind === "objective" ? t.objectives : kind === "item" ? t.items : t.steps;
  return set.has(sub) ? { ok: true } : { ok: false, why: `names ${kind} "${sub}", which ${tid} does not declare${kind === "objective" ? "" : " under any current or former id"}` };
};
// A published lesson depends on a reference to itself or its parts, and on a simulation (or a checkpoint of one) it embeds.
const publishedTopic = (ref) => {
  const sim = /^(?:sim:([a-z0-9-]+)|checkpoint:([a-z0-9-]+)\/[a-z0-9-]+)$/.exec(ref);
  if (sim) return [...touchable.keys()].some((tid) => isPublished(tid) && touchable.get(tid).sims.has(sim[1] ?? sim[2]));
  const m = /^(?:(?:objective|item|step|topic):)?([a-z0-9/-]+?)(?:[#:][a-z0-9-]+)?$/.exec(ref);
  return Boolean(m && isPublished(m[1]));
};
const knowledge = loadRecords(path.join(ROOT, "knowledge"), ROOT);
errors.push(...knowledge.problems);
{
  const r = recordProblems(knowledge.records, { resolve: resolveRef, publishedTopic });
  errors.push(...r.errors);
  warnings.push(...r.warnings);
}

// Resources: resources/<pathId>.json against the schema; a resource's topic must exist.
const RES_DIR = path.join(ROOT, "resources");
let resourceFiles = 0;
for (const file of walk(RES_DIR, ".json")) {
  resourceFiles += 1;
  const raw = json(file);
  if (!raw.ok) continue;
  const r = check(ResourcesSchema, raw.value, rel(file));
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
  `✓ valid — ${prod.length} prod topic(s)${includeStaging ? ` + ${staging.length} staged` : ""}, ${parsedPaths.length} path(s), ${Object.keys(glossaries).length} glossary file(s), ${resourceFiles} resource file(s), ${simIds.size} simulation(s), ${knowledge.records.length} knowledge record(s); every .mdx compiles, with no JavaScript.`,
);
