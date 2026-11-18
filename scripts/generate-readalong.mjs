#!/usr/bin/env node
/**
 * Narrate lessons for <ReadAlong /> with ElevenLabs /with-timestamps: an MP3 in the audio bucket
 * and its sentence cues in `audio/<topic id>.json` (ReadAlongAudioSchema), which a prop-less
 * `<ReadAlong />` in the lesson renders. The read-along workflow (.github/workflows/readalong.yml)
 * runs this; it works the same by hand.
 *
 *   node scripts/generate-readalong.mjs --all [options]            # every lesson holding <ReadAlong />
 *   node scripts/generate-readalong.mjs topics/x/y.mdx [options]   # just these lessons
 *   node scripts/generate-readalong.mjs --sample topics/x/y.mdx --voices ID,ID,ID   # voice samples
 *
 * A lesson whose narration text, voice and model match its audio/<id>.json is skipped, so a run
 * spends credits only on lessons whose prose changed. Lessons longer than one request are sent in
 * paragraph chunks (with the neighbouring text for continuity) and stitched back together.
 *
 * Options:
 *   --dry-run           Say what would be narrated and how many characters it costs; call nothing
 *   --force             Regenerate even when the audio is up to date
 *   --voice <id>        ElevenLabs voice (default: READALONG_VOICE env, else Bella hpp4J3VqNfWAUOO0d1Us)
 *   --model <id>        ElevenLabs model (default: READALONG_MODEL env, else eleven_multilingual_v2)
 *   --bucket <name>     GCS bucket for the MP3s (or AUDIO_BUCKET env); required to write audio files
 *   --max-chars <n>     Characters per request (default 9000, under the model's per-request limit)
 *   --budget <n>        Stop before a run would send more than this many characters (default 60000)
 *   --out <dir>         Local copies and samples (default: .readalong-out, gitignored)
 *   --voices <a,b,c>    With --sample: the voices to compare (default: Bella, Alice, River)
 *   --paragraph <n>     With --sample: which paragraph to read (default: the first of 200+ characters)
 *
 * Needs ELEVENLABS_API_KEY (never printed), and `gcloud` signed in to write to the bucket.
 * MP3 objects are named by a hash of their content and cached as immutable.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { extractSpokenText, narrationHash, narrationParagraphs } from "../pipeline/readalong-text.mjs";
import { ReadAlongAudioSchema, check } from "../schema/content-schema.mjs";

export { extractSpokenText };

export const DEFAULT_VOICE = "hpp4J3VqNfWAUOO0d1Us"; // Bella: crisp diction for long-form technical narration
export const DEFAULT_MODEL = "eleven_multilingual_v2";
export const SAMPLE_VOICES = ["hpp4J3VqNfWAUOO0d1Us", "Xb7hH8MSUJpSbSDYk0k2", "SAz9YHcvj6GT2YYXdXww"]; // Bella, Alice, River
const VOICE_NAMES = { hpp4J3VqNfWAUOO0d1Us: "bella", Xb7hH8MSUJpSbSDYk0k2: "alice", SAz9YHcvj6GT2YYXdXww: "river", XrExE9yKIg1WjnnlVkGX: "matilda", onwK4e9ZLuTAKqWW03F9: "daniel" };
const ROOT = process.cwd();
const TREES = ["topics", path.join("staging", "topics")];

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

/**
 * The narration's paragraphs grouped into requests of at most `maxChars` (joined by blank lines).
 * A paragraph longer than that is split at sentence ends; a sentence longer than that is an error.
 */
export function chunkParagraphs(paragraphs, maxChars) {
  const pieces = paragraphs.flatMap((p, paragraph) => {
    if (p.length <= maxChars) return [{ text: p, paragraph, joinNext: false }];
    const sentences = p.split(/(?<=[.!?]["')\]”’]?)\s+/);
    const parts = [];
    let cur = "";
    for (const s of sentences) {
      if (s.length > maxChars) throw new Error(`a sentence of ${s.length} characters is longer than --max-chars ${maxChars}`);
      if (cur && cur.length + 1 + s.length > maxChars) {
        parts.push(cur);
        cur = s;
      } else cur = cur ? `${cur} ${s}` : s;
    }
    if (cur) parts.push(cur);
    return parts.map((text, i) => ({ text, paragraph, joinNext: i < parts.length - 1 }));
  });
  const chunks = [];
  let cur = null;
  for (const piece of pieces) {
    const sep = cur?.last.paragraph === piece.paragraph ? " " : "\n\n";
    if (cur && cur.text.length + sep.length + piece.text.length <= maxChars) {
      cur.text += sep + piece.text;
      cur.last = piece;
    } else {
      if (cur) chunks.push(cur);
      cur = { text: piece.text, first: piece, last: piece };
    }
  }
  if (cur) chunks.push(cur);
  // `continues`: the chunk ends mid-paragraph, so the next chunk's first cue belongs to the same paragraph.
  return chunks.map((c, i) => ({ text: c.text, continues: i < chunks.length - 1 && chunks[i + 1].first.paragraph === c.last.paragraph }));
}

const MP3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]; // MPEG-1 Layer III, kbps
const MP3_RATES = [44100, 48000, 32000];

/** The playing time of an MPEG-1 Layer III buffer, in seconds, from its frame headers (an ID3v2 tag is skipped). */
export function mp3Duration(buf) {
  let i = 0;
  if (buf.length >= 10 && buf.toString("latin1", 0, 3) === "ID3") i = 10 + ((buf[6] & 0x7f) << 21) + ((buf[7] & 0x7f) << 14) + ((buf[8] & 0x7f) << 7) + (buf[9] & 0x7f);
  let seconds = 0;
  while (i + 4 <= buf.length) {
    const sync = buf[i] === 0xff && (buf[i + 1] & 0xfe) === 0xfa; // MPEG-1, Layer III
    const bitrate = MP3_BITRATES[buf[i + 2] >> 4];
    const rate = MP3_RATES[(buf[i + 2] >> 2) & 3];
    if (!sync || !bitrate || !rate) {
      i += 1;
      continue;
    }
    const length = Math.floor((144000 * bitrate) / rate) + ((buf[i + 2] >> 1) & 1);
    seconds += 1152 / rate;
    i += length;
  }
  return seconds;
}

/** Each request's audio and alignment, stitched: one MP3, and cues offset by the audio before them. */
export function mergeChunks(results, chunks) {
  const cues = [];
  let offset = 0;
  let paragraphBase = 0;
  results.forEach(({ audio, alignment }, i) => {
    const part = buildSentenceCues(alignment);
    for (const c of part) cues.push({ ...c, start: Number((c.start + offset).toFixed(3)), end: Number((c.end + offset).toFixed(3)), paragraph: c.paragraph + paragraphBase });
    const lastParagraph = part.length ? part[part.length - 1].paragraph : -1;
    paragraphBase += lastParagraph + (chunks[i]?.continues ? 0 : 1);
    offset += mp3Duration(audio);
  });
  return { audio: Buffer.concat(results.map((r) => r.audio)), cues };
}

/** A lesson file's topic id: its path under topics/ or staging/topics/, without .mdx. */
/**
 * A flag, else the environment, else the default. An empty value counts as unset: GitHub passes
 * an undefined repository variable (vars.READALONG_VOICE) as "", which is no voice id.
 */
export function setting(flag, env, fallback) {
  return flag || env || fallback;
}

export function topicIdOf(file) {
  const posix = path.relative(ROOT, path.resolve(file)).split(path.sep).join("/");
  const m = /^(?:staging\/)?topics\/(.+)\.mdx$/.exec(posix);
  if (!m) throw new Error(`${file}: not a lesson under topics/ or staging/topics/`);
  return m[1];
}

/** Whether a lesson body holds a prop-less <ReadAlong /> (its narration lives in audio/<id>.json). */
export const usesAudioFile = (raw) => /<ReadAlong\b(?![^>]*\b(?:src|cues)\s*=)[^>]*\/>/.test(raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ""));

/** Every lesson file under topics/ and staging/topics/. */
function lessonFiles() {
  const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".mdx") ? [path.join(dir, e.name)] : [])) : []);
  return TREES.flatMap((t) => walk(path.join(ROOT, t)));
}

/** Why a lesson needs new audio, or null when its audio/<id>.json already matches. */
export function staleReason(existing, want) {
  if (!existing) return "no audio yet";
  if (existing.textHash !== want.textHash) return "its text changed";
  if (existing.voice !== want.voice) return `voice ${existing.voice} → ${want.voice}`;
  if (existing.model !== want.model) return `model ${existing.model} → ${want.model}`;
  return null;
}

async function synthesize({ text, voice, model, apiKey, previous, next }) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`;
  const body = { text, model_id: model };
  if (previous) body.previous_text = previous.slice(-1000);
  if (next) body.next_text = next.slice(0, 1000);
  const res = await fetch(url, { method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`ElevenLabs API error (${res.status}): ${(await res.text()).slice(0, 500)}`);
  const data = await res.json();
  // `alignment` follows the text we sent (the lesson's own words, paragraph breaks included);
  // `normalized_alignment` follows ElevenLabs' spelled-out text ("128" → "one hundred twenty-eight").
  const alignment = data.alignment ?? data.normalized_alignment;
  if (!data.audio_base64 || !alignment?.characters) throw new Error("ElevenLabs returned no audio or no character alignment");
  return { audio: Buffer.from(data.audio_base64, "base64"), alignment };
}

function upload(file, bucket, object) {
  execFileSync("gcloud", ["storage", "cp", "--cache-control=public, max-age=31536000, immutable", "--content-type=audio/mpeg", file, `gs://${bucket}/${object}`], { stdio: ["ignore", "inherit", "inherit"] });
  return `https://storage.googleapis.com/${bucket}/${object}`;
}

function parseArgs(args) {
  const valued = new Set(["--voice", "--model", "--bucket", "--out", "--max-chars", "--budget", "--voices", "--paragraph", "--sample"]);
  const opts = { files: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (valued.has(a)) {
      opts[a.slice(2)] = args[i + 1];
      i += 1;
    } else if (a.startsWith("--")) opts[a.slice(2)] = true;
    else opts.files.push(a);
  }
  return opts;
}

const summary = (line) => {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
};

async function samples(opts, apiKey) {
  const file = opts.sample;
  const paragraphs = narrationParagraphs(extractSpokenText(fs.readFileSync(file, "utf8")));
  const n = opts.paragraph !== undefined ? Number(opts.paragraph) : Math.max(0, paragraphs.findIndex((p) => p.length >= 200));
  const text = paragraphs[n];
  if (!text) throw new Error(`${file} has no paragraph ${n}`);
  const voices = (opts.voices ?? SAMPLE_VOICES.join(",")).split(",").map((v) => v.trim()).filter(Boolean);
  const model = setting(opts.model, process.env.READALONG_MODEL, DEFAULT_MODEL);
  summary(`Voice samples: ${path.basename(file)}, paragraph ${n} (${text.length} characters × ${voices.length} voices = ${text.length * voices.length})\n\n> ${text}\n`);
  if (opts["dry-run"]) return;
  const dir = path.join(opts.out, "samples");
  fs.mkdirSync(dir, { recursive: true });
  for (const voice of voices) {
    const { audio } = await synthesize({ text, voice, model, apiKey });
    const out = path.join(dir, `${VOICE_NAMES[voice] ?? voice}-${voice}.mp3`);
    fs.writeFileSync(out, audio);
    summary(`- ${VOICE_NAMES[voice] ?? voice} (${voice}): ${path.relative(ROOT, out)}, ${mp3Duration(audio).toFixed(1)} s`);
  }
}

async function main(args) {
  const opts = parseArgs(args);
  opts.out ??= path.join(ROOT, ".readalong-out");
  const dryRun = !!opts["dry-run"];
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!dryRun && !apiKey) throw new Error("Missing ELEVENLABS_API_KEY.");
  if (opts.sample) return samples(opts, apiKey);

  const voice = setting(opts.voice, process.env.READALONG_VOICE, DEFAULT_VOICE);
  const model = setting(opts.model, process.env.READALONG_MODEL, DEFAULT_MODEL);
  const bucket = setting(opts.bucket, process.env.AUDIO_BUCKET, "");
  const maxChars = Number(opts["max-chars"] ?? 9000);
  const budget = Number(opts.budget ?? 60000);
  if (!dryRun && !bucket) throw new Error("No bucket: pass --bucket or set AUDIO_BUCKET (audio/<id>.json needs the MP3's https URL).");

  const files = opts.all ? lessonFiles().filter((f) => usesAudioFile(fs.readFileSync(f, "utf8"))) : opts.files;
  if (!files.length) {
    summary(opts.all ? "No lesson holds a prop-less <ReadAlong />: nothing to narrate." : "Usage: node scripts/generate-readalong.mjs (--all | <lesson.mdx>...) [--dry-run] [--force] [--sample <lesson.mdx>] …");
    return opts.all ? 0 : 1;
  }

  let spent = 0;
  let failed = 0;
  summary(`Read-along audio (voice ${VOICE_NAMES[voice] ?? voice}, model ${model}${dryRun ? ", dry run" : ""})\n`);
  for (const file of files) {
    const id = topicIdOf(file);
    const text = extractSpokenText(fs.readFileSync(file, "utf8"));
    const want = { textHash: narrationHash(text), voice, model };
    const sidecar = path.join(ROOT, "audio", `${id}.json`);
    const existing = fs.existsSync(sidecar) ? JSON.parse(fs.readFileSync(sidecar, "utf8")) : null;
    const reason = opts.force ? "forced" : staleReason(existing, want);
    if (!reason) {
      summary(`- ${id}: up to date`);
      continue;
    }
    if (spent + text.length > budget) {
      summary(`- ${id}: skipped, ${text.length} characters would pass the run's budget of ${budget} (raise --budget or run again)`);
      continue;
    }
    if (dryRun) {
      summary(`- ${id}: would narrate (${reason}), ${text.length} characters in ${chunkParagraphs(narrationParagraphs(text), maxChars).length} request(s)`);
      spent += text.length;
      continue;
    }
    try {
      const chunks = chunkParagraphs(narrationParagraphs(text), maxChars);
      const results = [];
      for (const [i, chunk] of chunks.entries()) results.push(await synthesize({ text: chunk.text, voice, model, apiKey, previous: chunks[i - 1]?.text, next: chunks[i + 1]?.text }));
      spent += text.length;
      const { audio, cues } = mergeChunks(results, chunks);
      const hash = crypto.createHash("sha256").update(audio).digest("hex").slice(0, 12);
      const local = path.join(opts.out, `${id}.${hash}.mp3`);
      fs.mkdirSync(path.dirname(local), { recursive: true });
      fs.writeFileSync(local, audio);
      const src = upload(local, bucket, `topics/${id}.${hash}.mp3`);
      const record = { src, voice, model, textHash: want.textHash, cues };
      const r = check(ReadAlongAudioSchema, record, `audio/${id}.json`);
      if (!r.ok) throw new Error(r.problems.join("; "));
      fs.mkdirSync(path.dirname(sidecar), { recursive: true });
      fs.writeFileSync(sidecar, `${JSON.stringify(record, null, 2)}\n`);
      summary(`- ${id}: narrated (${reason}), ${text.length} characters, ${cues.length} sentences, ${mp3Duration(audio).toFixed(0)} s`);
    } catch (e) {
      failed += 1;
      summary(`- ${id}: FAILED: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  summary(`\n${dryRun ? "Would send" : "Sent"} ${spent} characters (≈ credits).`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = (await main(process.argv.slice(2))) ?? 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}
