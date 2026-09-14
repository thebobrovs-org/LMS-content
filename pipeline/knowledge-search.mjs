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

/** The records of an index that match: every word in the title or scope, the topic in `touches`, the tag in `tags`. */
export function search(index, { topic, tag, words = [] } = {}) {
  const w = words.map((x) => x.toLowerCase());
  return index.records.filter((r) => {
    if (topic && !r.touches.some((t) => t === topic || t === `topic:${topic}` || t.startsWith(`objective:${topic}#`) || t.startsWith(`item:${topic}#`) || t.startsWith(`step:${topic}:`))) return false;
    if (tag && !r.tags.includes(tag)) return false;
    const text = `${r.title}\n${r.scope}`.toLowerCase();
    return w.every((x) => text.includes(x));
  });
}

/** Words that carry no signal for retrieval; kept short and English, like the records. */
const STOPWORDS = new Set("a an and are as at be by can do does for from how i if in is it its my of on or so than that the this to was what when where which why will with you your".split(" "));

/** The searchable tokens of a text: lowercase words of two or more letters or digits, plurals folded, stopwords dropped. */
export function tokens(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/**
 * Rank an index's records for a question (text search, no synonyms, no embeddings): each
 * distinct question token scores 3 in the title, 2 in the scope, 2 in a tag and 1 in the slug of
 * a `touches` reference or of the id, summed; a record that touches `topic` gets 2 more. Records
 * scoring 0 are left out. Returns the top `k` as `{ record, score, matched }`, ties broken by
 * id. This is the retrieval the mentor's benchmark measures (hyperstack#71) and the mentor's
 * service reuses (hyperstack ADR 0006 §4): the same code, so what is measured is what ships.
 */
export function rank(index, question, { topic, k = 5 } = {}) {
  const q = [...new Set(tokens(question))];
  const scored = [];
  for (const r of index.records) {
    const title = new Set(tokens(r.title));
    const scope = new Set(tokens(r.scope));
    const tags = new Set((r.tags ?? []).flatMap(tokens));
    const slugs = new Set([r.id, ...r.touches].flatMap((t) => tokens(t.replace(/^[a-z]+:/, ""))));
    let score = 0;
    const matched = [];
    for (const w of q) {
      const s = (title.has(w) ? 3 : 0) + (scope.has(w) ? 2 : 0) + (tags.has(w) ? 2 : 0) + (slugs.has(w) ? 1 : 0);
      if (s) {
        score += s;
        matched.push(w);
      }
    }
    if (topic && r.touches.some((t) => t === topic || t === `topic:${topic}` || t.startsWith(`objective:${topic}#`) || t.startsWith(`item:${topic}#`) || t.startsWith(`step:${topic}:`))) score += 2;
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
  const question = opt("--rank");
  const k = Number(opt("--k") ?? 5);
  const words = args.filter((a) => a !== "--json");
  const root = rootArg ? path.resolve(rootArg) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const file = path.join(root, "knowledge", "index.json");
  if (!fs.existsSync(file)) { console.error(`no ${file}: run node pipeline/knowledge-index.mjs`); process.exit(1); }
  const index = JSON.parse(fs.readFileSync(file, "utf8"));
  if (question !== undefined) {
    const ranked = rank(index, question, { topic, k });
    process.stdout.write(json ? `${JSON.stringify(ranked.map((h) => ({ id: h.record.id, score: h.score, matched: h.matched })), null, 2)}\n` : ranked.length ? ranked.map((h) => `${String(h.score).padStart(3)}  ${h.record.id}  (${h.matched.join(", ")})`).join("\n") + "\n" : "no record scores for this question\n");
  } else {
    const found = search(index, { topic, tag, words });
    process.stdout.write(json ? `${JSON.stringify(found, null, 2)}\n` : format(found));
  }
}
