// The narration of a lesson for <ReadAlong> (scripts/generate-readalong.mjs): the prose a learner
// would hear, and its hash. Shared with content CI (pipeline/validate.mjs), which warns when a
// lesson's audio/<id>.json was made from text the lesson no longer holds.
import crypto from "node:crypto";

// One attribute run inside a JSX opening tag: plain characters, quoted strings, or a {…} literal
// nested up to two levels (`props={{ a: [1] }}`, `cues={[{ start: 0 }]}`), so a `>` or `/>` inside
// an attribute value never ends the tag early.
const ATTRS = String.raw`(?:[^>"'{}]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*`;
// Components whose content is interactive or visual, not narration: removed with everything inside them.
const DROPPED = "Simulation|Flashcard|Quiz|YouTube|Figure|ReadAlong";
const PAIRED_DROPPED = new RegExp(String.raw`<(${DROPPED})\b${ATTRS}(?<!\/)>[\s\S]*?<\/\1\s*>`, "g");
const SELF_CLOSING_DROPPED = new RegExp(String.raw`<(?:${DROPPED})\b${ATTRS}\/>`, "g");
// A <Step>'s title is read as its heading; the other wrappers just give way to their content.
const STEP_OPEN = new RegExp(String.raw`<Step\b(${ATTRS})(?<!\/)>`, "g");
const ANY_TAG = new RegExp(String.raw`<\/?[A-Za-z][\w.-]*\b${ATTRS}\/?>`, "g");

const sentence = (s) => (/[.!?:]["')\]”’]?$/.test(s) ? s : `${s}.`);

/**
 * Strip YAML frontmatter, interactive MDX components, code blocks, tables and Markdown syntax,
 * keeping the prose a learner would hear, one paragraph per blank-line-separated block.
 */
export function extractSpokenText(raw) {
  let text = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  text = text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, "");
  // Paired first: a non-greedy self-closing match could otherwise run from <Quiz …> to a later `/>`.
  text = text.replace(PAIRED_DROPPED, "");
  text = text.replace(SELF_CLOSING_DROPPED, "");
  text = text.replace(STEP_OPEN, (_, attrs) => {
    const title = /\btitle=(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\})/.exec(attrs);
    const t = title ? (title[1] ?? title[2] ?? title[3]).trim() : "";
    return t ? `\n\n${sentence(t)}\n\n` : "\n\n";
  });
  text = text.replace(ANY_TAG, "");
  // Literal string expressions (`{" "}`, `{"text"}`) read as their text.
  text = text.replace(/\{\s*(["'])(.*?)\1\s*\}/g, "$2");
  text = text.replace(/^[ \t]*\|.*$/gm, ""); // tables aren't narrated
  text = text.replace(/^[ \t]*\[[^\]]+\]:[ \t]*\S.*$/gm, ""); // link definitions
  text = text.replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, ""); // thematic breaks
  text = text.replace(/^#{1,6}\s+(.+?)\s*#*\s*$/gm, (_, h) => `\n${sentence(h.trim())}\n`);
  text = text.replace(/^[ \t]*>[ \t]?/gm, "");
  text = text.replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+(.+)$/gm, (_, item) => `${sentence(item.trim())}`);
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1");
  text = text.replace(/\*\*|__|~~|[*`]/g, "");
  text = text.replace(/(^|[^\p{L}\p{N}])_+|_+(?=[^\p{L}\p{N}]|$)/gu, "$1"); // _emphasis_, not snake_case
  text = text.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, " ").replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim())
    .filter(Boolean)
    .join("\n\n");
}


/** The SHA-256 of a narration text: what audio/<id>.json records as `textHash`. */
export const narrationHash = (text) => crypto.createHash("sha256").update(text, "utf8").digest("hex");

/** The narration split into paragraphs, as the text sent to ElevenLabs separates them. */
export const narrationParagraphs = (text) => text.split("\n\n").filter(Boolean);
