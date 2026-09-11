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
import { compile } from "@mdx-js/mdx";
import { parseFrontmatter } from "./frontmatter.mjs";
import { effectiveGlossary, pathsByTopic as indexPathsByTopic, termKeys } from "./glossary.mjs";
import {
  GlossarySchema, MDX_COMPONENTS, PathFrontmatterSchema, ResourcesSchema, SimConfigSchema, TopicFrontmatterSchema, check,
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
const ALLOWED = new Set(MDX_COMPONENTS);
// The HTML a lesson may write directly: prose elements only. Nothing that scripts,
// embeds, loads or styles (script, iframe, object, embed, video, svg, style, form, …).
const HTML_ELEMENTS = new Set([
  "a", "abbr", "b", "blockquote", "br", "code", "dd", "del", "details", "div", "dl", "dt", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre", "s", "small", "span",
  "strong", "sub", "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "var", "wbr",
]);
// The attributes those elements may carry, plus aria-* and data-*. Not dangerouslySetInnerHTML,
// srcDoc, style or an on* handler: an HTML string or a handler is code, whatever carries it.
const HTML_ATTRIBUTES = new Set(["alt", "className", "colSpan", "height", "href", "id", "lang", "open", "rel", "rowSpan", "src", "start", "target", "title", "width"]);
// A URL a lesson may point at: a same-site path or fragment, http(s), or mailto. Never javascript:, data: or another scheme.
// A browser drops leading and trailing C0 controls and spaces, and any tab or newline, before it reads the scheme
// (" javascript:", "java\tscript:"), so a URL holding any of them is rejected rather than normalized: encode it.
const SAFE_SCHEMES = new Set(["http", "https", "mailto"]);
const UNSAFE_URL_CHARS = /[\u0000-\u0020\u007f]/;
const urlScheme = (url) => /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1].toLowerCase();

/**
 * Whether an ESTree node is literal data: a string, number, boolean or null, a
 * template with no substitutions, a negative number, or an array or object of the
 * same. That is what `{" "}`, `height={520}` and `props={{ keys: 24 }}` carry.
 * Anything else (an identifier, a call, an operator, a function) is code.
 */
export function isLiteralData(node) {
  switch (node?.type) {
    case "Literal":
      return node.value === null || ["string", "number", "boolean"].includes(typeof node.value);
    case "TemplateLiteral":
      return node.expressions.length === 0;
    case "UnaryExpression":
      return (node.operator === "-" || node.operator === "+") && node.argument.type === "Literal" && typeof node.argument.value === "number";
    case "ArrayExpression":
      return node.elements.every((e) => e !== null && isLiteralData(e));
    case "ObjectExpression":
      return node.properties.every(
        (p) => p.type === "Property" && !p.computed && p.kind === "init" && !p.method && (p.key.type === "Identifier" || p.key.type === "Literal") && isLiteralData(p.value),
      );
    default:
      return false;
  }
}

/** The single expression of an MDX expression's program, if it is literal data; else undefined. */
const literalOf = (estree) => (estree?.body?.length === 1 && estree.body[0].type === "ExpressionStatement" && isLiteralData(estree.body[0].expression) ? estree.body[0].expression : undefined);

/**
 * A JSX attribute's value when it is a string: `src="…"`, `src={"…"}` or a template with
 * no substitutions. Undefined for a boolean attribute (`<details open>`); null for
 * literal data of another shape (a number, an array, an object) or code.
 */
function stringValue(attribute) {
  if (attribute.value == null) return undefined;
  if (typeof attribute.value === "string") return attribute.value;
  const literal = literalOf(attribute.value.data?.estree);
  if (literal?.type === "Literal" && typeof literal.value === "string") return literal.value;
  if (literal?.type === "TemplateLiteral") return literal.quasis[0]?.value.cooked ?? null;
  return null;
}

/**
 * A remark plugin that enforces what a lesson may hold (AGENTS.md: prose plus the
 * documented components, no JavaScript) and collects every URL it references:
 * - no import or export; an expression may carry literal data only;
 * - a JSX tag is a documented component or one of HTML_ELEMENTS, whose attributes
 *   come from HTML_ATTRIBUTES (so no dangerouslySetInnerHTML, srcDoc or on*);
 * - a link or image URL, Markdown or JSX, has no scheme other than http(s) or mailto,
 *   and no whitespace or control character a browser would drop before reading it;
 *   `src` and `href` are strings.
 * `urls` receives the URLs of every image, link, definition and `src`/`href`.
 */
function lessonRules(urls) {
  return (tree, vfile) => {
    const url = (value, node, what) => {
      if (UNSAFE_URL_CHARS.test(value)) vfile.fail(`${what} holds whitespace or a control character, which a browser drops before reading the scheme; encode it`, node);
      const scheme = urlScheme(value);
      if (scheme && !SAFE_SCHEMES.has(scheme)) vfile.fail(`${what} may point at a same-site path, http(s) or mailto, not "${scheme}:"`, node);
      urls.push(value);
    };
    const visit = (node) => {
      if (node.type === "mdxjsEsm") vfile.fail("an import or export isn't allowed in a lesson", node);
      if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
        if (!literalOf(node.data?.estree)) vfile.fail(`a JavaScript expression isn't allowed in a lesson (only literal data such as {" "} or {42})`, node);
      }
      if ((node.type === "image" || node.type === "link" || node.type === "definition") && typeof node.url === "string") url(node.url, node, node.type === "link" ? "a link" : "an image");
      if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        const html = node.name != null && !ALLOWED.has(node.name);
        if (html && !HTML_ELEMENTS.has(node.name)) {
          vfile.fail(/^[a-z]/.test(node.name) ? `<${node.name}> isn't HTML a lesson may write (${[...HTML_ELEMENTS].join(", ")})` : `<${node.name}> isn't a documented component (${[...ALLOWED].join(", ")})`, node);
        }
        for (const a of node.attributes ?? []) {
          if (a.type !== "mdxJsxAttribute") vfile.fail(`a spread attribute isn't allowed on <${node.name}>`, node);
          else {
            if (html && !HTML_ATTRIBUTES.has(a.name) && !/^(aria|data)-[a-z][a-z0-9-]*$/.test(a.name)) {
              vfile.fail(`<${node.name} ${a.name}>: a lesson's HTML may carry only ${[...HTML_ATTRIBUTES].join(", ")}, aria-* and data-*`, node);
            }
            if (a.value && typeof a.value === "object" && !literalOf(a.value.data?.estree)) {
              vfile.fail(`<${node.name} ${a.name}={…}>: an attribute may carry only literal data (a string, number, boolean, array or object of those)`, node);
            }
            if (a.name === "src" || a.name === "href") {
              const value = stringValue(a);
              if (value === null) vfile.fail(`<${node.name} ${a.name}={…}> must be a string`, node);
              else if (value !== undefined) url(value, node, `<${node.name} ${a.name}>`);
            }
          }
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}

/** Compile one MDX body as the app would; a failure names the file and its line in the file. Returns the URLs it references, or null. */
async function compiles(file, content, bodyLine) {
  const urls = [];
  try {
    await compile(content, { development: false, remarkPlugins: [() => lessonRules(urls)] });
    return urls;
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

/** The checks a topic or path body needs beyond its frontmatter: it compiles under the lesson rules, and its media exist. */
async function checkBody(id, file, content, bodyLine) {
  const urls = await compiles(file, content, bodyLine);
  for (const ref of mediaRefs(urls ?? [])) {
    const problem = mediaProblem(ref);
    if (problem) errors.push(`${id}: ${problem}`);
  }
}

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
  for (const m of content.matchAll(/<Simulation[^>]*\bid=(["'])(.*?)\1/g)) {
    if (!simIds.has(m[2])) errors.push(`${id}: simulation "${m[2]}" has no simulations/packages/${m[2]}`);
  }
  await checkBody(id, file, content, bodyLine);
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
  await checkBody(`path ${pid}`, file, content, bodyLine);
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
  `✓ valid — ${prod.length} prod topic(s)${includeStaging ? ` + ${staging.length} staged` : ""}, ${parsedPaths.length} path(s), ${Object.keys(glossaries).length} glossary file(s), ${resourceFiles} resource file(s), ${simIds.size} simulation(s); every .mdx compiles, with no JavaScript.`,
);
