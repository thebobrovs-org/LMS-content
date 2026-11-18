// Tests for scripts/generate-readalong.mjs: what a lesson's narration holds, and how ElevenLabs'
// character timings become the sentence cues <ReadAlong> renders. Run by `npm run gate`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSentenceCues, chunkParagraphs, extractSpokenText, mergeChunks, mp3Duration, setting, staleReason, topicIdOf, usesAudioFile } from "./generate-readalong.mjs";
import { narrationHash } from "../pipeline/readalong-text.mjs";

/** A fake alignment: one character per 0.1 s. */
const align = (s) => ({
  characters: [...s],
  character_start_times_seconds: [...s].map((_, i) => i / 10),
  character_end_times_seconds: [...s].map((_, i) => i / 10 + 0.1),
});
const texts = (s) => buildSentenceCues(align(s)).map((c) => c.text);

test("a paired component is removed alone: the prose before a later self-closing tag survives", () => {
  const out = extractSpokenText(`---
title: x
---
Intro text.

<Quiz question="Is a > b?" choices={["a", "b"]} answer={0}>
Why?
</Quiz>

This prose must survive.

<Figure src="/media/a.png" alt="x" />

<Simulation id="s" props={{ names: ["a"], on: true }} />

<ReadAlong src="/media/a.mp3" cues={[{ start: 0, end: 1, text: "Hi." }]} />

End.`);
  assert.equal(out, "Intro text.\n\nThis prose must survive.\n\nEnd.");
});

test("Markdown and wrapper components give way to the words a learner hears", () => {
  const out = extractSpokenText(`# Caching

Use <Term id="kv">the KV cache</Term> and **bold** words, \`max_tokens\` and _emphasis_.{" "}See [the docs](https://x.y) ![a diagram](/media/d.png).

- first item
- second item.

| a | b |
|---|---|
| 1 | 2 |

\`\`\`py
print("code")
\`\`\`

<Steps>
<Step title="Measure">
Profile it.
</Step>
</Steps>

<Callout type="tip">Cache wisely &amp; often.</Callout>`);
  assert.equal(
    out,
    [
      "Caching.",
      "Use the KV cache and bold words, max_tokens and emphasis. See the docs.",
      "first item. second item.",
      "Measure.",
      "Profile it.",
      "Cache wisely & often.",
    ].join("\n\n"),
  );
});

test("sentences split at their full stops, not inside words that end like an abbreviation", () => {
  assert.deepEqual(texts("Agents run inside larger systems. They pick items. Compare cost vs. latency here. Done, e.g. now. Check the freq. Next one."), [
    "Agents run inside larger systems.",
    "They pick items.",
    "Compare cost vs. latency here.",
    "Done, e.g. now.",
    "Check the freq.",
    "Next one.",
  ]);
});

test("a closing quote or bracket after the stop ends the sentence with it; decimals don't split", () => {
  assert.deepEqual(texts('He said "stop." Gemini 2.5 is fast (really!) Then done.'), ['He said "stop."', "Gemini 2.5 is fast (really!)", "Then done."]);
});

test("cues carry their paragraph, numbered contiguously, with times from the first and last characters", () => {
  const cues = buildSentenceCues(align("One. Two.\n\n\n\nThree.\nStill three."));
  assert.deepEqual(
    cues.map((c) => [c.paragraph, c.text]),
    [
      [0, "One."],
      [0, "Two."],
      [1, "Three."],
      [1, "Still three."],
    ],
  );
  assert.equal(cues[0].start, 0);
  assert.equal(cues[0].end, 0.4);
  assert.equal(cues[1].start, 0.5);
});

/** `n` silent-looking MPEG-1 Layer III frames at 128 kbps / 44.1 kHz (417 bytes each, 1152 samples). */
const frames = (n) => Buffer.concat(Array.from({ length: n }, () => Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(413)])));

test("mp3Duration counts frames, skipping an ID3v2 tag", () => {
  assert.equal(mp3Duration(frames(0)), 0);
  assert.ok(Math.abs(mp3Duration(frames(100)) - (100 * 1152) / 44100) < 1e-9);
  const id3 = Buffer.concat([Buffer.from("ID3"), Buffer.from([4, 0, 0, 0, 0, 0, 0, 20]), Buffer.alloc(20), frames(10)]);
  assert.ok(Math.abs(mp3Duration(id3) - (10 * 1152) / 44100) < 1e-9);
});

test("chunkParagraphs packs whole paragraphs under the limit and splits an overlong one at sentence ends", () => {
  assert.deepEqual(chunkParagraphs(["aaaa.", "bbbb.", "cccc."], 12), [
    { text: "aaaa.\n\nbbbb.", continues: false },
    { text: "cccc.", continues: false },
  ]);
  const long = chunkParagraphs(["One two. Three four. Five six."], 20);
  assert.deepEqual(long.map((c) => c.text), ["One two. Three four.", "Five six."]);
  assert.deepEqual(long.map((c) => c.continues), [true, false]);
  assert.throws(() => chunkParagraphs(["A very long sentence without a stop"], 10), /longer than --max-chars/);
});

test("mergeChunks offsets each request's cues by the audio before it and keeps paragraphs contiguous", () => {
  const second = (100 * 1152) / 44100;
  const results = [
    { audio: frames(100), alignment: align("One.\n\nTwo.") },
    { audio: frames(10), alignment: align("Two more.") },
    { audio: frames(10), alignment: align("Three.") },
  ];
  const { audio, cues } = mergeChunks(results, [{ continues: true }, { continues: false }, { continues: false }]);
  assert.equal(audio.length, 120 * 417);
  assert.deepEqual(cues.map((c) => [c.paragraph, c.text]), [[0, "One."], [1, "Two."], [1, "Two more."], [2, "Three."]]);
  assert.equal(cues[2].start, Number(second.toFixed(3)));
});

test("a lesson needs new audio when its text, voice or model changed, and not otherwise", () => {
  const want = { textHash: narrationHash("Hi."), voice: "v", model: "m" };
  assert.equal(staleReason(null, want), "no audio yet");
  assert.equal(staleReason({ ...want }, want), null);
  assert.equal(staleReason({ ...want, textHash: narrationHash("Hello.") }, want), "its text changed");
  assert.match(staleReason({ ...want, voice: "w" }, want), /voice w → v/);
  assert.match(staleReason({ ...want, model: "n" }, want), /model n → m/);
});

test("only a prop-less <ReadAlong /> opts a lesson into audio files, and topic ids come from the path", () => {
  assert.equal(usesAudioFile("---\ntitle: x\n---\nIntro.\n\n<ReadAlong />\n"), true);
  assert.equal(usesAudioFile('<ReadAlong title="Listen" />'), true);
  assert.equal(usesAudioFile('<ReadAlong src="/media/a.mp3" cues={[]} />'), false);
  assert.equal(usesAudioFile("No player here."), false);
  assert.equal(topicIdOf("topics/math-infra/what-is-a-tensor.mdx"), "math-infra/what-is-a-tensor");
  assert.equal(topicIdOf("staging/topics/agentic-ai/x.mdx"), "agentic-ai/x");
  assert.throws(() => topicIdOf("paths/p.mdx"), /not a lesson/);
});

test("a setting is the flag, else the environment, else the default; empty counts as unset", () => {
  assert.equal(setting("flagVoice", "envVoice", "default"), "flagVoice");
  assert.equal(setting(undefined, "envVoice", "default"), "envVoice");
  assert.equal(setting(undefined, "", "default"), "default");
  assert.equal(setting(undefined, undefined, "default"), "default");
});

test("a list item wrapped over several lines is read as one sentence, not cut at the line break", () => {
  const text = extractSpokenText("- **Tools** that let it read data or act: functions,\n  APIs, databases, even other agents.\n- A loop.\n  - nested item\n");
  assert.equal(text, "Tools that let it read data or act: functions, APIs, databases, even other agents. A loop. nested item.");
});

test("Sources, Suggested videos and similar sections are not narrated, up to the next heading of their level", () => {
  const out = extractSpokenText(`---
title: T
---
Intro prose.

## Why it matters

Body prose.

## Sources

- Google, "Agents", example.com/agents.

### A sub-heading under Sources

Still skipped.

## Suggested videos

- A talk worth watching.

## Further Reading:

More links.

## Put it together

Closing prose.

\`\`\`md
## Sources
\`\`\`

## Resources at scale

Read: a title that only starts like a skipped one.
`);
  assert.equal(
    out,
    "Intro prose.\n\nWhy it matters.\n\nBody prose.\n\nPut it together.\n\nClosing prose.\n\nResources at scale.\n\nRead: a title that only starts like a skipped one.",
  );
});
