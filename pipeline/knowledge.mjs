// The knowledge records (knowledge/, LMS-content#105, hyperstack ADR 0005): loading, checking
// and indexing. The validator (validate.mjs) runs `recordProblems` with resolvers for the
// curriculum it has just loaded; `knowledge-index.mjs` writes knowledge/index.json from the
// approved records. Pure functions over parsed records, so the tests need no repository.
import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter.mjs";
import { check } from "../schema/content-schema.mjs";
import { FOLDER_OF, RECORD_TYPES, RecordFrontmatterSchema, sourcesOf, titleOf } from "../schema/knowledge-schema.mjs";

const rel = (root, f) => path.relative(root, f).split(path.sep).join("/");

const ID = `(?:${RECORD_TYPES.join("|")})\\/[a-z0-9]+(?:-[a-z0-9]+)*`;
const TYPE_OF_FOLDER = Object.fromEntries(Object.entries(FOLDER_OF).map(([t, f]) => [f, t]));

/**
 * Every record a body links to, as ids, and the links that are broken. Forms: a Markdown link
 * or reference definition whose destination is a record file (`[the claim](../claims/x.md)`,
 * `[claim/x]: ../claims/x.md`, and usages of it: `[claim/x][ref]`, `[ref][]`, `[ref]`), which must
 * exist and, when the label is itself an id, match it; a destination may be written `<…>`;
 * `[[claim/x]]`; and a bare `claim/x` in backticks. `file` is the record's own path, for
 * relative destinations. Anything else that looks like a link is left to Markdown.
 */
export function linksIn(body, file = "knowledge/x/y.md", exists = () => true) {
  const ids = new Set();
  const problems = new Set(); // one problem per destination, however many usages resolve to it
  const dir = path.posix.dirname(file);
  const idOfDest = (dest) => {
    const target = path.posix.normalize(path.posix.join(dir, dest.replace(/[#?].*$/, "")));
    const m = /^knowledge\/([a-z]+)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/.exec(target);
    if (!m || !TYPE_OF_FOLDER[m[1]]) return { outside: true };
    return { id: `${TYPE_OF_FOLDER[m[1]]}/${m[2]}`, target };
  };
  const take = (label, dest) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(dest) || dest.startsWith("/")) return; // a URL or a site path
    const { outside, id, target } = idOfDest(dest);
    if (outside) return;
    if (!exists(id)) { problems.add(`links to ${dest}, which is not a record (no ${target})`); return; }
    if (new RegExp(`^${ID}$`).test(label) && label !== id) problems.add(`links to ${dest} under the label "${label}", which is another record's id`);
    ids.add(id);
  };
  // A destination may be wrapped in angle brackets; a reference-style usage resolves through its definition.
  const dest = (d) => (d.startsWith("<") && d.endsWith(">") ? d.slice(1, -1) : d);
  // The first definition of a label wins, as Markdown resolves it; every definition's destination is still checked.
  const defs = new Map();
  const definitions = [];
  for (const m of body.matchAll(/^\[([^\]]+)\]:\s*(\S+)/gm)) {
    definitions.push([m[1], dest(m[2])]);
    if (!defs.has(m[1].toLowerCase())) defs.set(m[1].toLowerCase(), dest(m[2]));
  }
  const text = body.replace(/^\[[^\]]+\]:\s*\S+.*$/gm, "");
  for (const m of text.matchAll(/\[([^\]]*)\]\((<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\)/g)) take(m[1], dest(m[2]));
  for (const m of text.matchAll(/\[([^\]]*)\]\[([^\]]*)\]/g)) { const ref = (m[2] || m[1]).toLowerCase(); if (defs.has(ref)) take(m[1], defs.get(ref)); }
  for (const m of text.matchAll(/(?<!\])\[([^\]]+)\](?![\[(:])/g)) if (defs.has(m[1].toLowerCase())) take(m[1], defs.get(m[1].toLowerCase()));
  for (const [label, d] of definitions) take(label, d);
  for (const m of body.matchAll(new RegExp(`\\[\\[(${ID})\\]\\]|\`(${ID})\``, "g"))) {
    const id = m[1] ?? m[2];
    if (exists(id)) ids.add(id); else problems.add(`links to "${id}", which is not a record`);
  }
  return { ids: [...ids], problems: [...problems] };
}

/**
 * Something that looks like a person: an e-mail address or an @handle, anywhere in the text,
 * code spans included (a handle in backticks is still a handle). A question record must carry
 * none; write a decorator as `jax.jit`, not `@jax.jit`.
 */
export function identifierIn(text) {
  const m = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}|(?<!\w)@[A-Za-z0-9_]{2,}/.exec(text);
  return m ? m[0] : null;
}

/** Every string a record commits or publishes: its front matter's text fields (the terms included: the index publishes them) and its body. */
export function textOf(r) {
  const d = r.data;
  return [d.title, d.scope, ...(d.sources ?? []), d.source, ...(d.tags ?? []), ...(d.terms ?? []), d.provenance?.by, d.provenance?.model, d.provenance?.from, r.body].filter(Boolean).join("\n");
}

/**
 * A record's terms (LMS-content#111): the front matter's `terms` list, plus a concept's
 * **Canonical terms.** line (comma-separated; a parenthesised alias counts too), lowercased and
 * deduplicated, in the order given. What a question may call the record beyond its title, scope
 * and tags; the index carries them and the ranking scores a question word found among them.
 */
export function termsOf(data, body) {
  const line = /^\*\*Canonical terms\.\*\*\s*(.+?)\s*$/m.exec(body ?? "");
  const canonical = line ? line[1].replace(/\.$/, "").replace(/\(([^)]*)\)/g, ", $1").split(",") : [];
  return [...new Set([...(data.terms ?? []), ...canonical].map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Load every record under `dir` (knowledge/): `{ records, problems }`. A record is
 * `{ id, file, data, body, links, sources, title, terms }`; a file that cannot be read as a
 * record is a problem and is left out.
 */
export function loadRecords(dir, root = path.dirname(dir)) {
  const records = [];
  const problems = [];
  if (!fs.existsSync(dir)) return { records, problems };
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".md") && e.name !== "README.md" ? [path.join(d, e.name)] : []));
  for (const file of walk(dir).sort()) {
    const where = rel(root, file);
    let fm;
    try {
      fm = parseFrontmatter(fs.readFileSync(file, "utf8"), where);
    } catch (e) {
      problems.push(e.message);
      continue;
    }
    const r = check(RecordFrontmatterSchema, fm.data, where);
    problems.push(...r.problems);
    if (!r.ok) continue;
    const data = r.value;
    const expected = `${FOLDER_OF[data.type]}/${data.id.split("/")[1]}.md`;
    if (rel(dir, file) !== expected) problems.push(`${where}: a ${data.type} record "${data.id}" lives at knowledge/${expected}`);
    records.push({ id: data.id, file: where, data, body: fm.content, sources: sourcesOf(data), title: titleOf(data), terms: termsOf(data, fm.content) });
  }
  // Links resolve against the set just loaded, so a record may link forward to one later in the walk.
  const ids = new Set(records.map((r) => r.id));
  for (const r of records) {
    const l = linksIn(r.body, r.file, (id) => ids.has(id));
    r.links = l.ids;
    r.linkProblems = l.problems;
  }
  return { records, problems };
}

/** A title normalised for the near-duplicate warning: lowercase, words only. */
const key = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The problems and warnings in a set of records. `resolve` answers whether a `touches`
 * reference exists: `resolve(ref) → { ok: true } | { ok: false, why }`. `publishedTopic(ref)`
 * says whether a reference is to (or within) a published lesson, for the dispute rule.
 */
export function recordProblems(records, { resolve, publishedTopic = () => false, today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [];
  const warnings = [];
  const byId = new Map();
  for (const r of records) {
    const first = byId.get(r.id);
    if (first) errors.push(`${r.file}: id "${r.id}" is also ${first.file}'s`);
    else byId.set(r.id, r);
  }
  const titles = new Map();
  for (const r of records) {
    const { data } = r;
    const at = (msg) => `${r.file}: ${msg}`;
    if (data.status === "approved" && r.sources.length === 0) errors.push(at("an approved record names at least one source"));
    for (const ref of data.touches) {
      const res = resolve ? resolve(ref) : { ok: true };
      if (!res.ok) errors.push(at(`touches "${ref}", which ${res.why ?? "does not exist"}`));
    }
    for (const id of data.related ?? []) if (!byId.has(id)) errors.push(at(`related names "${id}", which is not a record`));
    for (const p of r.linkProblems ?? []) errors.push(at(p));
    if (data["superseded-by"] && !byId.has(data["superseded-by"])) errors.push(at(`superseded by "${data["superseded-by"]}", which is not a record`));
    if (data.status === "disputed" && data.touches.some(publishedTopic) && !data["disputed-by"]) {
      errors.push(at("a disputed record that a published lesson depends on names the open issue on that lesson (disputed-by: owner/repo#n)"));
    }
    if (data.type === "question") {
      const found = identifierIn(textOf(r));
      if (found) errors.push(at(`a question record carries what looks like a person ("${found}"); rewrite the question without it`));
    }
    if (data["review-by"] && data["review-by"] < today) warnings.push(at(`past its review-by date (${data["review-by"]})`));
    const k = key(r.title);
    const same = titles.get(k);
    if (same && same.id !== r.id) warnings.push(at(`its title reads like ${same.file}'s ("${same.title}"): one idea, one record`));
    else if (!same) titles.set(k, r);
  }
  return { errors, warnings };
}

/**
 * The index the app and the agents read: approved records only, sorted by id, with the links
 * between them both ways. Deterministic, so the gate can check the committed file.
 */
/** `simulations` is the map simulation → published topics that embed it (pipeline/lesson-sims.mjs), so retrieval by topic reaches `sim:` and `checkpoint:` references (LMS-content#110). */
export function buildIndex(records, { simulations = {} } = {}) {
  const approved = records.filter((r) => r.data.status === "approved").sort((a, b) => (a.id < b.id ? -1 : 1));
  const ids = new Set(approved.map((r) => r.id));
  const backlinks = new Map();
  for (const r of approved) for (const to of new Set([...r.links, ...(r.data.related ?? [])])) if (ids.has(to)) (backlinks.get(to) ?? backlinks.set(to, []).get(to)).push(r.id);
  return {
    version: 1,
    note: "Generated by `node pipeline/knowledge-index.mjs` from the approved records in knowledge/; never edited by hand.",
    simulations,
    records: approved.map((r) => ({
      id: r.id,
      type: r.data.type,
      title: r.title,
      scope: r.data.scope,
      tags: r.data.tags ?? [],
      terms: r.terms ?? termsOf(r.data, r.body),
      touches: r.data.touches,
      sources: r.sources,
      reviewed: r.data.reviewed,
      reviewBy: r.data["review-by"] ?? null,
      links: [...new Set([...r.links, ...(r.data.related ?? [])])].filter((id) => ids.has(id)).sort(),
      backlinks: (backlinks.get(r.id) ?? []).sort(),
      file: r.file,
    })),
  };
}

export const indexText = (index) => `${JSON.stringify(index, null, 2)}\n`;
