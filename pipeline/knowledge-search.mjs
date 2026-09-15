#!/usr/bin/env node
// Retrieve before you write (hyperstack#70, ADR 0005): the approved records that touch a
// topic, carry a tag, or mention every given word in their title or scope, read from
// knowledge/index.json. Text search over the index, by design: semantic retrieval waits for
// the benchmark (hyperstack#71). Prints ids, titles, scopes, what they touch and their sources.
//   node pipeline/knowledge-search.mjs --topic ml-systems/jax-xla-stack
//   node pipeline/knowledge-search.mjs --tag roofline
//   node pipeline/knowledge-search.mjs padding tile
//   node pipeline/knowledge-search.mjs --json …   (the matching records as JSON, for a script)
//   node pipeline/knowledge-search.mjs --rank "why does a 129-wide matmul waste slots" [--topic t] [--k 5]
//                                              (the top records for a question, scored; the mentor's retrieval)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Whether a record touches a topic: through the topic itself, one of its objectives, items or
 * steps, or a simulation or checkpoint the lesson embeds (the index's `simulations` map,
 * LMS-content#110); the lesson id alone, never the `topic:` prefix, is what a caller passes.
 */
export function touchesTopic(index, record, topic) {
  return record.touches.some((t) => {
    if (t === topic || t === `topic:${topic}` || t.startsWith(`objective:${topic}#`) || t.startsWith(`item:${topic}#`) || t.startsWith(`step:${topic}:`)) return true;
    const sim = /^(?:sim:([a-z0-9][a-z0-9-]*)|checkpoint:([a-z0-9][a-z0-9-]*)\/[a-z0-9][a-z0-9-]*)$/.exec(t);
    return sim !== null && (index.simulations?.[sim[1] ?? sim[2]] ?? []).includes(topic);
  });
}

/** The records of an index that match: every word in the title or scope, the topic in `touches` (touchesTopic), the tag in `tags`. */
export function search(index, { topic, tag, words = [] } = {}) {
  const w = words.map((x) => x.toLowerCase());
  return index.records.filter((r) => {
    if (topic && !touchesTopic(index, r, topic)) return false;
    if (tag && !r.tags.includes(tag)) return false;
    const text = `${r.title}\n${r.scope}`.toLowerCase();
    return w.every((x) => text.includes(x));
  });
}

/** Words that carry no signal for retrieval; kept short and English, like the records. */
const STOPWORDS = new Set("a an and are as at be by can do does for from how i if in is it its my of on or so than that the this to was what when where which why will with you your".split(" "));

/** The searchable tokens of a text: lowercase words of two or more letters or digits, stopwords dropped, a trailing `s` (not `ss`) folded whenever two or more characters remain. */
export function tokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    .map((w) => (w.length >= 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/**
 * The synonyms the ranking knows (LMS-content#111): a small, reviewed map from what a question
 * may say to the words the records use. A phrase is matched whole, case-insensitively, on word
 * boundaries; the question keeps its own words and gains the canonical ones, so a record named
 * either way scores. Grow it from the benchmark's misses, never from one question.
 */
export const SYNONYMS = Object.freeze({
  pointwise: "elementwise",
  "element-wise": "elementwise",
  "bandwidth-limited": "memory-bound",
  "bandwidth limited": "memory-bound",
  "bandwidth-bound": "memory-bound",
  "memory limited": "memory-bound",
  "compute-limited": "compute-bound",
  mantissa: "significand",
  "half precision": "fp16",
  "half-precision": "fp16",
  "brain float": "bf16",
  bfloat16: "bf16",
  buffer: "footprint allocation",
  allocate: "allocation",
  allocates: "allocation",
  allocated: "allocation",
  recompilation: "recompile",
  recompiles: "recompile",
  "kernel fusion": "fusion",
  "operator fusion": "fusion",
  "loss scaling": "loss-scaling",
  "gradient scaling": "loss-scaling",
});
const SYNONYM_RE = new RegExp(`(?<![a-z0-9])(${Object.keys(SYNONYMS).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![a-z0-9])`, "gi");
/** The question with each synonym's canonical words appended after it (the original words stay). */
export const expandSynonyms = (text) => String(text ?? "").replace(SYNONYM_RE, (m) => `${m} ${SYNONYMS[m.toLowerCase()]}`);

/** The slug of a reference or an id, without its kind: `claim/x` → `x`, `objective:t#o` → `t#o`, `sim:x` → `x`. */
const slugOf = (ref) => ref.replace(/^[a-z]+[:/]/, "");

/** The largest `k` the ranking returns; a request is one question, not a listing. */
export const RANK_MAX = 50;

/**
 * Rank an index's records for a question (text search with a small synonym map, no embeddings):
 * the question is expanded with SYNONYMS first, then each distinct token scores 3 in the title,
 * 2 in the scope, 2 in a tag, 2 in the record's terms (its canonical terms and its `terms`
 * list, LMS-content#111) and 1 in the slug of the id or of a `touches` reference (the kind,
 * `claim/` or `objective:`, is not searchable), summed; a record that touches `topic` gets 2 more. Records scoring 0 are left out. Returns the
 * top `k` (1 to RANK_MAX) as `{ record, score, matched }`, ties broken by id; an empty question
 * or a `k` outside the range throws. This is the retrieval the mentor's benchmark measures (hyperstack#71) and the mentor's
 * service reuses (hyperstack ADR 0006 §4): the same code, so what is measured is what ships.
 */
export function rank(index, question, { topic, k = 5 } = {}) {
  if (typeof question !== "string" || !question.trim()) throw new TypeError("rank needs a question");
  if (!(Number.isInteger(k) && k >= 1 && k <= RANK_MAX)) throw new RangeError(`k must be an integer from 1 to ${RANK_MAX}`);
  const q = [...new Set(tokens(expandSynonyms(question)))];
  const scored = [];
  for (const r of index.records) {
    const title = new Set(tokens(r.title));
    const scope = new Set(tokens(r.scope));
    const tags = new Set((r.tags ?? []).flatMap(tokens));
    const terms = new Set((r.terms ?? []).flatMap(tokens));
    const slugs = new Set([r.id, ...r.touches].flatMap((t) => tokens(slugOf(t))));
    let score = 0;
    const matched = [];
    for (const w of q) {
      const s = (title.has(w) ? 3 : 0) + (scope.has(w) ? 2 : 0) + (tags.has(w) ? 2 : 0) + (terms.has(w) ? 2 : 0) + (slugs.has(w) ? 1 : 0);
      if (s) {
        score += s;
        matched.push(w);
      }
    }
    if (topic && touchesTopic(index, r, topic)) score += 2;
    if (score > 0) scored.push({ record: r, score, matched });
  }
  return scored.sort((a, b) => b.score - a.score || (a.record.id < b.record.id ? -1 : 1)).slice(0, k);
}

export function format(records) {
  if (!records.length) return "no approved record matches; if the fact is new, draft a record first (knowledge/README.md)\n";
  return records
    .map((r) => `${r.id}\n  ${r.title}\n  scope: ${r.scope}\n  touches: ${r.touches.join(", ") || "(nothing yet)"}\n  sources: ${r.sources.join(" | ")}\n  file: ${r.file}`)
    .join("\n\n") + "\n";
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const rootArg = opt("--root");
  const json = args.includes("--json");
  const topic = opt("--topic");
  const tag = opt("--tag");
  const ranking = args.includes("--rank");
  const question = opt("--rank");
  const hasK = args.includes("--k");
  const kArg = opt("--k");
  const k = !hasK ? 5 : kArg !== undefined && /^\d+$/.test(kArg) ? Number(kArg) : NaN;
  if (ranking && (question === undefined || !question.trim())) { console.error("--rank needs a question"); process.exit(2); }
  if (!(Number.isInteger(k) && k >= 1 && k <= RANK_MAX)) { console.error(`--k must be an integer from 1 to ${RANK_MAX}`); process.exit(2); }
  const words = args.filter((a) => a !== "--json");
  const root = rootArg ? path.resolve(rootArg) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const file = path.join(root, "knowledge", "index.json");
  if (!fs.existsSync(file)) { console.error(`no ${file}: run node pipeline/knowledge-index.mjs`); process.exit(1); }
  const index = JSON.parse(fs.readFileSync(file, "utf8"));
  if (ranking) {
    const ranked = rank(index, question, { topic, k });
    process.stdout.write(json ? `${JSON.stringify(ranked.map((h) => ({ id: h.record.id, score: h.score, matched: h.matched })), null, 2)}\n` : ranked.length ? ranked.map((h) => `${String(h.score).padStart(3)}  ${h.record.id}  (${h.matched.join(", ")})`).join("\n") + "\n" : "no record scores for this question\n");
  } else {
    const found = search(index, { topic, tag, words });
    process.stdout.write(json ? `${JSON.stringify(found, null, 2)}\n` : format(found));
  }
}
