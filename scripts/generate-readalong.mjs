#!/usr/bin/env node
/**
 * Generate a pre-converted MP3 and sentence-level cues for <ReadAlong> using
 * ElevenLabs /with-timestamps, and optionally upload the MP3 to a GCS bucket.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node scripts/generate-readalong.mjs <path-to-lesson.mdx> [options]
 *
 * Options:
 *   --dry-run           Print extracted text and character count without calling the API
 *   --voice <id>        ElevenLabs voice ID (default: Bella hpp4J3VqNfWAUOO0d1Us)
 *   --model <id>        ElevenLabs model ID (default: eleven_multilingual_v2)
 *   --bucket <name>     GCS bucket name (or AUDIO_BUCKET env) to upload via `gcloud storage cp`
 *   --out <dir>         Output directory for .mp3/.cues.json (default: .readalong-out, gitignored)
 *   --max-chars <n>     Refuse text longer than this before calling the API (default: 10000,
 *                       the per-request limit we plan for with eleven_multilingual_v2)
 *
 * The uploaded object's name carries a short hash of the MP3 (`<topic>.<sha8>.mp3`), so a
 * regenerated lesson gets a new URL and a cached old MP3 can never play against new cues.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

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

/** A buffer that ends in one of these is not a sentence end, even though it ends in a full stop. */
const ABBREVIATION_END = /(?:^|[^\p{L}])(?:e\.g|i\.e|etc|vs|cf|dr|mr|mrs|ms|prof|fig|eq|approx)\.$/iu;
const CLOSERS = /["')\]”’]/;

/** Group ElevenLabs character-level alignment into paragraph-aware sentence-level cues. */
export function buildSentenceCues(alignment) {
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = alignment;
  const cues = [];
  let buf = "";
  let cueStart = null;
  let cueEnd = null;
  let paragraph = 0;

  const flush = () => {
    if (buf.trim().length > 0 && cueStart !== null) {
      cues.push({ start: Number(cueStart.toFixed(3)), end: Number(cueEnd.toFixed(3)), text: buf.trim(), paragraph });
    }
    buf = "";
    cueStart = null;
    cueEnd = null;
  };

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    if (ch === "\n") {
      if (characters[i + 1] === "\n") {
        flush();
        // Numbered by paragraphs that hold a cue, so the numbers stay contiguous.
        if (cues.length > 0 && cues[cues.length - 1].paragraph === paragraph) paragraph += 1;
        while (characters[i + 1] === "\n") i += 1;
      } else if (buf && !/\s$/.test(buf)) {
        buf += " ";
      }
      continue;
    }

    if (cueStart === null && ch.trim() !== "") cueStart = starts[i];
    buf += ch;
    if (ch.trim() !== "") cueEnd = ends[i];

    const next = characters[i + 1];
    const atBoundary = next === undefined || /\s/.test(next);
    const punct = /[.!?]/.test(ch) || (CLOSERS.test(ch) && /[.!?]/.test(characters[i - 1] ?? ""));
    const abbreviation = ch === "." && ABBREVIATION_END.test(buf.trimStart());
    if (punct && atBoundary && !abbreviation) flush();
  }

  flush();
  return cues;
}

const USAGE = "Usage: node scripts/generate-readalong.mjs <lesson.mdx> [--dry-run] [--voice ID] [--model ID] [--bucket NAME] [--out DIR] [--max-chars N]";

async function main(args) {
  const flag = (name, fallback) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
  };
  const valued = new Set(["--voice", "--model", "--bucket", "--out", "--max-chars"]);
  const mdxPath = args.find((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
  const dryRun = args.includes("--dry-run");
  if (!mdxPath) {
    console.error(USAGE);
    return 1;
  }

  // Default: Bella (Standard American, crisp diction for long-form technical narration)
  const VOICE_ID = flag("--voice", "hpp4J3VqNfWAUOO0d1Us");
  const MODEL_ID = flag("--model", "eleven_multilingual_v2");
  const BUCKET = flag("--bucket", process.env.AUDIO_BUCKET || "");
  const OUT_DIR = flag("--out", path.join(process.cwd(), ".readalong-out"));
  const MAX_CHARS = Number(flag("--max-chars", "10000"));

  const raw = fs.readFileSync(mdxPath, "utf8");
  const spokenText = extractSpokenText(raw);
  const slug = path.basename(mdxPath, ".mdx");
  const posix = mdxPath.split(path.sep).join("/");
  const relTopic = posix.includes("topics/") ? posix.slice(posix.lastIndexOf("topics/")).replace(/\.mdx$/, "") : slug;
  const tooLong = Number.isFinite(MAX_CHARS) && spokenText.length > MAX_CHARS;

  console.log(`Lesson: ${relTopic}`);
  console.log(`Characters (≈ credits): ${spokenText.length}${tooLong ? ` (over --max-chars ${MAX_CHARS})` : ""}`);
  console.log(`Model: ${MODEL_ID} | Voice: ${VOICE_ID}`);

  if (dryRun) {
    console.log(`\n--- Extracted Text ---\n${spokenText}\n----------------------`);
    return 0;
  }
  if (tooLong) {
    console.error(`\nThe spoken text is ${spokenText.length} characters, over the ${MAX_CHARS} a single request is planned for. Split the lesson into sections with one <ReadAlong> each, or pass --max-chars if your model allows more.`);
    return 1;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("Missing ELEVENLABS_API_KEY env var.");
    return 1;
  }

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOICE_ID)}/with-timestamps?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text: spokenText, model_id: MODEL_ID }),
  });
  if (!res.ok) {
    console.error(`ElevenLabs API error (${res.status}): ${await res.text()}`);
    return 1;
  }

  const data = await res.json();
  const audioBuf = Buffer.from(data.audio_base64, "base64");
  // `alignment` follows the text we sent (the lesson's own words, paragraph breaks included);
  // `normalized_alignment` follows ElevenLabs' spelled-out text ("128" → "one hundred twenty-eight").
  const alignment = data.alignment ?? data.normalized_alignment;
  if (!alignment?.characters) {
    console.error("ElevenLabs returned no character alignment; cannot build cues.");
    return 1;
  }
  const cues = buildSentenceCues(alignment);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const mp3Out = path.join(OUT_DIR, `${slug}.mp3`);
  const cuesOut = path.join(OUT_DIR, `${slug}.cues.json`);
  fs.writeFileSync(mp3Out, audioBuf);
  fs.writeFileSync(cuesOut, `${JSON.stringify(cues, null, 2)}\n`);
  console.log(`\nSaved MP3:  ${mp3Out} (${(audioBuf.length / 1024).toFixed(1)} KB)`);
  console.log(`Saved Cues: ${cuesOut} (${cues.length} sentences)`);

  let audioSrc = `/media/audio/${slug}.mp3`;
  if (BUCKET) {
    const hash = crypto.createHash("sha256").update(audioBuf).digest("hex").slice(0, 8);
    const object = `${relTopic}.${hash}.mp3`;
    try {
      execFileSync("gcloud", ["storage", "cp", mp3Out, `gs://${BUCKET}/${object}`], { stdio: "inherit" });
    } catch (e) {
      console.error(`\nUpload to gs://${BUCKET}/${object} failed (${e.code ?? e.status ?? e.message}). The MP3 and cues are saved above; upload the MP3 by hand and use its https URL as src.`);
      return 1;
    }
    audioSrc = `https://storage.googleapis.com/${BUCKET}/${object}`;
  } else {
    console.log(`\nNo --bucket given: nothing was uploaded. Upload ${mp3Out} and replace src with its https URL (content CI requires a /media/ src to exist in media/).`);
  }

  console.log(`\nPaste into MDX:\n<ReadAlong src="${audioSrc}" cues={${JSON.stringify(cues)}} />\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
