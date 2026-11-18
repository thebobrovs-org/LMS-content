// Tests for scripts/generate-readalong.mjs: what a lesson's narration holds, and how ElevenLabs'
// character timings become the sentence cues <ReadAlong> renders. Run by `npm run gate`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSentenceCues, extractSpokenText } from "./generate-readalong.mjs";

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
