#!/usr/bin/env node
// Retrieve before you write (hyperstack#70, ADR 0005): the approved records that touch a
// topic, carry a tag, or mention every given word in their title or scope, read from
// knowledge/index.json. Text search over the index, by design: semantic retrieval waits for
// the benchmark (hyperstack#71). Prints ids, titles, scopes, what they touch and their sources.
//   node pipeline/knowledge-search.mjs --topic ml-systems/jax-xla-stack
//   node pipeline/knowledge-search.mjs --tag roofline
//   node pipeline/knowledge-search.mjs padding tile
//   node pipeline/knowledge-search.mjs --json …   (the matching records as JSON, for a script)
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
  const words = args.filter((a) => a !== "--json");
  const root = rootArg ? path.resolve(rootArg) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const file = path.join(root, "knowledge", "index.json");
  if (!fs.existsSync(file)) { console.error(`no ${file}: run node pipeline/knowledge-index.mjs`); process.exit(1); }
  const index = JSON.parse(fs.readFileSync(file, "utf8"));
  const found = search(index, { topic, tag, words });
  process.stdout.write(json ? `${JSON.stringify(found, null, 2)}\n` : format(found));
}
