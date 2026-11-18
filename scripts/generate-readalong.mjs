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
 *   --out <dir>         Output directory for .mp3/.cues.json (default: .readalong-out)
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const mdxPath = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

if (!mdxPath) {
  console.error("Usage: node scripts/generate-readalong.mjs <lesson.mdx> [--dry-run] [--voice ID] [--model ID] [--bucket NAME] [--out DIR]");
  process.exit(1);
}

// Default: Bella (Standard American, crisp diction for long-form technical narration)
const VOICE_ID = flag("--voice", "hpp4J3VqNfWAUOO0d1Us");
const MODEL_ID = flag("--model", "eleven_multilingual_v2");
const BUCKET = flag("--bucket", process.env.AUDIO_BUCKET || "");
const OUT_DIR = flag("--out", path.join(process.cwd(), ".readalong-out"));

/** Strip YAML frontmatter, interactive MDX components, code blocks, and markdown syntax while preserving paragraph breaks. */
export function extractSpokenText(raw) {
  let text = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/<(Simulation|Flashcard|Quiz|YouTube|Figure|ReadAlong)\b[\s\S]*?\/>/g, "");
  text = text.replace(/<(Simulation|Flashcard|Quiz|ReadAlong)\b[\s\S]*?<\/\1>/g, "");
  text = text.replace(/<\/?(Callout|Term|Tip|Steps|Step)\b[^>]*>/g, "");
  text = text.replace(/\{\s*["']\s*["']\s*\}/g, " ");
  text = text.replace(/^#{1,6}\s+(.+)$/gm, (_, h) => (/[.!?]$/.test(h.trim()) ? h.trim() : `${h.trim()}.`));
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/[*_`~]/g, "");
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\r?\n+/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

const ABBREVIATIONS = /(?:e\.g|i\.e|etc|vs|Dr|Mr|Ms|Prof|Fig|Eq|approx)\./i;

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
      cues.push({
        start: Number(cueStart.toFixed(3)),
        end: Number(cueEnd.toFixed(3)),
        text: buf.trim(),
        paragraph,
      });
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
        paragraph += 1;
        i += 1;
      }
      continue;
    }

    if (cueStart === null && ch.trim() !== "") cueStart = starts[i];
    buf += ch;
    if (ch.trim() !== "") cueEnd = ends[i];

    const next = characters[i + 1];
    const isEndPunct = /[.!?]/.test(ch) && (next === undefined || /\s/.test(next));
    const isAbbrev = ch === "." && ABBREVIATIONS.test(buf.trim().slice(-10));

    if (isEndPunct && !isAbbrev && buf.trim().length > 0) {
      flush();
    }
  }

  flush();
  return cues;
}

const raw = fs.readFileSync(mdxPath, "utf8");
const spokenText = extractSpokenText(raw);
const slug = path.basename(mdxPath, ".mdx");
const relTopic = mdxPath.includes("topics/") ? mdxPath.slice(mdxPath.indexOf("topics/")).replace(/\.mdx$/, "") : slug;

console.log(`Lesson: ${relTopic}`);
console.log(`Characters (≈ credits): ${spokenText.length}`);
console.log(`Model: ${MODEL_ID} | Voice: ${VOICE_ID}`);

if (dryRun) {
  console.log(`\n--- Extracted Text ---\n${spokenText}\n----------------------`);
  process.exit(0);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("Missing ELEVENLABS_API_KEY env var.");
  process.exit(1);
}

const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: spokenText,
    model_id: MODEL_ID,
  }),
});

if (!res.ok) {
  console.error(`ElevenLabs API error (${res.status}): ${await res.text()}`);
  process.exit(1);
}

const data = await res.json();
const audioBuf = Buffer.from(data.audio_base64, "base64");
const cues = buildSentenceCues(data.normalized_alignment || data.alignment);

fs.mkdirSync(OUT_DIR, { recursive: true });
const mp3Out = path.join(OUT_DIR, `${slug}.mp3`);
const cuesOut = path.join(OUT_DIR, `${slug}.cues.json`);
fs.writeFileSync(mp3Out, audioBuf);
fs.writeFileSync(cuesOut, `${JSON.stringify(cues, null, 2)}\n`);

let audioSrc = `/media/audio/${slug}.mp3`;
if (BUCKET) {
  const gcsPath = `gs://${BUCKET}/${relTopic}.mp3`;
  execFileSync("gcloud", ["storage", "cp", mp3Out, gcsPath], { stdio: "inherit" });
  audioSrc = `https://storage.googleapis.com/${BUCKET}/${relTopic}.mp3`;
}

console.log(`\nSaved MP3:  ${mp3Out} (${(audioBuf.length / 1024).toFixed(1)} KB)`);
console.log(`Saved Cues: ${cuesOut} (${cues.length} sentences)`);
console.log(`\nPaste into MDX:\n<ReadAlong src="${audioSrc}" cues={${JSON.stringify(cues)}} />\n`);
