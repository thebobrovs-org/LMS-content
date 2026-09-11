/**
 * How a topic's <Term>s resolve (LMS-content#63). Glossaries are per path:
 * glossary/<pathId>.json. A topic's effective glossary is the union of the glossaries
 * of the paths that list it, or, for a topic in no path, the union of all glossaries.
 *
 * Both validators use this, so they can't disagree: pipeline/validate.mjs (the whole
 * repo, in CI) and skills/lms-authoring-topics/scripts/validate.mjs (one file, for
 * authors).
 */
import fs from "node:fs";
import path from "node:path";

/** { pathId: { term: entry } } from the glossary/<pathId>.json files in `dir` (empty if there are none). */
export function loadGlossaries(dir) {
  const glossaries = {};
  if (!fs.existsSync(dir)) return glossaries;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(".json")) glossaries[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  return glossaries;
}

/** topic id → the Set of path ids whose levels list it, from parsed paths ([{ pid, data }]). */
export function pathsByTopic(paths) {
  const byTopic = new Map();
  for (const { pid, data } of paths) {
    for (const lvl of data.levels ?? []) {
      for (const tid of lvl.topics ?? []) {
        if (!byTopic.has(tid)) byTopic.set(tid, new Set());
        byTopic.get(tid).add(pid);
      }
    }
  }
  return byTopic;
}

/** The glossary a topic's <Term>s resolve in: its paths' glossaries, or all of them if it's in no path. */
export function effectiveGlossary(topicId, glossaries, byTopic) {
  const pids = byTopic.get(topicId);
  if (!pids || pids.size === 0) return Object.assign({}, ...Object.values(glossaries));
  return Object.assign({}, ...[...pids].map((p) => glossaries[p] ?? {}));
}

/** The glossary keys a topic's MDX uses: each <Term>'s id attribute, or else its text, lower-cased and trimmed. */
export function termKeys(content) {
  return [...content.matchAll(/<Term\b([^>]*)>([\s\S]*?)<\/Term>/g)].map((m) => {
    const idAttr = m[1].match(/\bid=["']([^"']+)["']/);
    return (idAttr ? idAttr[1] : m[2]).toLowerCase().trim();
  });
}
