---
name: lms-authoring-topics
description: Author or edit an LMS lesson topic — a single MDX file (one topic = one knowledge-graph node) with YAML frontmatter (metadata, graph edges, flashcards, quiz) and an MDX body (prose plus the whitelisted components Simulation, YouTube, Callout, Flashcard, Quiz, Steps). Use when creating a new lesson, editing an existing one, adding retrieval-practice items, or embedding a simulation/video into a lesson. Covers file location, the exact frontmatter contract, the component catalog, voice/tone, and how to validate.
---

# Authoring a lesson topic

A **topic** is one lesson: a single `.mdx` file that is also one node in the
knowledge graph. Prose, simulation, video, and recall items live together in that
one file so it reviews as a unit.

## Knowledge first

Before writing or changing a lesson, retrieve what the platform already
established (hyperstack ADR 0005):

```bash
node pipeline/knowledge-search.mjs --topic <this or a neighbouring topic id>
node pipeline/knowledge-search.mjs <key term> [<key term> …]
```

An approved record (`knowledge/<folder>/<slug>.md`, indexed in
`knowledge/index.json`) is a fact already checked against its source: rely on it
and name its id in the PR's **Knowledge delta**; cite the same source locator in
the lesson. A fact the lesson needs that no record holds becomes a record first
(`knowledge/README.md`), `proposed`, with its sources; regenerate the index. A
lesson never carries a number its sources or its records cannot support.

## Where it goes

```
topics/<subject>/<slug>.mdx
```

- The file path under `topics/` (without `.mdx`) IS the topic **`id`**,
  e.g. `topics/data-structures/hash-tables.mdx` → id `data-structures/hash-tables`.
- Draft new topics under `staging/topics/<subject>/<slug>.mdx` (`sme-content-pipeline`); `pipeline/promote.mjs` moves them to `topics/`.
- Folders are organizational only (subjects like `fundamentals/`, `systems/`,
  `ml-systems/`). **The real structure is the graph** (prerequisite/related
  edges), not the folders.
- Use kebab-case slugs. **Never put `id` in a topic's frontmatter**: the schema is strict and the app derives the id from the path.

## Anatomy of a topic file

```mdx
---
title: Hash Tables
summary: Key–value storage with O(1) average lookup via hashing.
tags: [data-structures, hashing, performance]
difficulty: intermediate
estimatedMinutes: 25
prerequisites: [fundamentals/arrays]
relatedTo: [systems/caching]
flashcards:
  - front: What is the average-case lookup time of a hash table?
    back: O(1), assuming a good hash function and low load factor.
    id: lookup-cost            # optional, a slug unique in the topic (ADR 0004): progress is keyed by it
quiz:
  - question: What typically degrades hash-table performance?
    choices:
      - A high load factor with poor collision handling
      - Using integer keys
      - Having too few keys
    answer: 0
    explanation: As the load factor rises, collisions approach O(n).
    id: load-factor
    formerIds: [1k2j3h]        # the ids (hashes included) it had before, so learners' progress follows
status: published
---

## How hashing works

Prose explaining the concept, then prove it with a simulation.

<Simulation id="hash-collision" height={420} />

<Callout type="tip">A load factor above ~0.7 is a common resize trigger.</Callout>
```

The full field-by-field contract is in
[reference/frontmatter.md](reference/frontmatter.md); the component catalog is in
[reference/mdx-components.md](reference/mdx-components.md). A complete, annotated
example is [examples/binary-search.mdx](examples/binary-search.mdx).

## Required frontmatter (CI-enforced)

`title`, `summary`, `tags` (≥1), `difficulty` (`beginner|intermediate|advanced`),
`estimatedMinutes` (positive integer). Everything else has a sensible default.
`id` is derived from the path and is never set in frontmatter.

## The MDX body

Plain Markdown plus a **whitelisted** set of components (no arbitrary scripts):

- `<Simulation id="…" height={…} props={{…}} />` — embed an interactive sim. The
  `id` must be a package in `simulations/packages/<id>/` (build sims first).
- `<YouTube id="…" start={…} title="…" />` — privacy-friendly lazy video at one point in the lesson (for videos to watch after it, see Suggested videos).
- `<Callout type="tip|note|warning">…</Callout>` — styled aside.
- `<Flashcard front="…" back="…" />` — inline recall card (also schedulable).
- `<Quiz question="…" choices={[…]} answer={0} explanation="…" />` — inline MCQ.
- `<Steps><Step title="…">…</Step></Steps>` — a tracked, numbered walkthrough;
  each step is a progress checkpoint that feeds topic mastery.
- `<Figure src="/media/…" alt="…" caption="…" />` — a framed, captioned image.
  Put files in `media/…` and reference them as `/media/…`; bare Markdown `![alt](src)` also works (auto-styled).
  Prefer SVG for diagrams. `alt` is required.

Put a check (flashcard/quiz/step) right after the thing it tests — "do it, then
recall it."

## Suggested videos

A lesson may list videos for learners who want to see the idea explained or demoed, in the frontmatter's
`videos` (field contract: [reference/frontmatter.md](reference/frontmatter.md)). The app renders them after the
lesson body under "Suggested videos", behind a "Show N videos" toggle like the sources: a thumbnail that loads the
privacy-friendly youtube-nocookie player only when the learner presses play, the channel, length and date, the
`why` and the `note`, and each chapter as a chip that plays the video from that moment. Use `<YouTube>` in the body
instead when the video belongs at one point in the lesson.

- **Official sources first**: Google, Google Cloud Tech, Google for Developers and the like for a Google product;
  the publisher's own channel otherwise. Open the watch page and confirm the id, title, channel, length and date.
- **One to three per lesson**, the best first. Prefer a short, current video to a long, broad one.
- **Chapters are the point for a long video.** Copy the times from the video's own chapter list (the description or
  the player's chapter menu), as YouTube shows them, quoted: `at: "13:16"`. Pick the two to five chapters that
  match the lesson, and label them in a few words.
- **`why`** says in one sentence what the video adds to this lesson, by naming the section or decision it matches.
- **`note`** is the caveat a learner needs before watching, in one short sentence: an older product name the
  video still uses ("Uses the older Vertex AI Agent Engine name (now Agent Runtime)."), a partial match, a long
  video with no chapters. Don't recommend a video that teaches an outdated name without saying so here. Leave
  out anything only authors care about.

## Sources (every lesson ends with them)

End the body with a `## Sources` heading and a Markdown list, one source per
item, in this form:

```mdx
## Sources

- Google Cloud, [Agent Gateway overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview) (retrieved 2026-11-17: centralizes access policies, mTLS and Model Armor for agent traffic).
- Yao et al. (2022), [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) (the reason-act loop the lesson traces).
```

The app renders the list as a table behind a "Show N sources" toggle,
collapsed by default: the **title** as a link, the **publisher**, and **what it
supports** (LMS `lib/content/sources-table.mjs`). So each item is:

1. **Publisher** (and series, if any) first, then a comma: `Google, Agent Development Kit documentation,`.
2. **The title as a Markdown link** to the exact page, with a full `https://`
   URL: `[Function tools](https://github.com/google/adk-docs/blob/main/docs/tools-custom/function-tools.md)`.
   One link per item; the page title, not "here" or the raw URL.
3. **One closing parenthetical** saying what the source supports in this
   lesson, with the retrieval date for anything that changes (docs, pricing,
   product pages): `(retrieved 2026-11-17: max_llm_calls, default 500 per run)`.
   Inline `code` is fine inside it.

Keep anything else (a version, an edition, "section 3.1") between the link and
the parenthetical: it shows under the title. A source with no URL (a paper in
print) keeps its title in quotes: `- Norm Hardy, "The Confused Deputy", ACM SIGOPS Operating Systems Review 22(4), 1988 (the term).`
Don't put prose or notes in the list (it becomes a table row); write them as a
paragraph above the list. Cite a `knowledge/` record's source with the same
URL the record carries.

The older plain form (`- Google, "Title", host/path (…)`, a quoted title and a
bare domain) still renders, but write new and revised lessons with links.

## Voice & tone (match the brand)

- **Plain, confident, teacherly.** Short declarative sentences that explain a
  concept and then prove it. Use "you" for the learner.
- **Sentence case** everywhere (headings, buttons). No Title Case, no emoji.
- **Be technically precise** — correct terms, Big-O, exact mechanisms; reinforce
  with inline `code`. The audience expects rigor.
- **Labels reinforce, never rely on color** — "Tip"/"Warning" always read as text.

## Retrieval practice

- **Give every item and step an `id`** (ADR 0004): a slug that names what it teaches, unique in the topic (items share one namespace, steps another). Progress is keyed by it, so a **rewording keeps the id**; a **change of meaning gets a new id** (retire the old one, never reuse it); a **rename lists the old id in `formerIds`** (`former-ids={[…]}` on `<Quiz>`, `<Flashcard>` and `<Step>`). An item without an id is keyed by a hash of its prompt, and the gate warns when such a prompt changes (`--base`), naming the old hash to list as a former id.
- `flashcards` (frontmatter) and inline `<Flashcard>` → active recall.
- `quiz` (frontmatter) and inline `<Quiz>` → auto-graded MCQs.
- An item **without** an `id` is keyed by a hash of its prompt text: reordering
  is safe, but editing the prompt resets that item's schedule. Giving it an `id`
  keeps its history by itself (the app treats the prompt's hash as a former id
  of any item that has an id); a reworded item that *never* had an id lists the
  old prompt's hash in `formerIds` (the gate's warning names it).
- All of these feed the spaced-repetition engine and the `/review` session
  automatically — you just author them.

## Mastery signals

A topic is "mastered" when its **coverage** (sim checkpoints + completed Steps)
and **retention** (flashcards/quizzes held at a ≥7-day interval) are all met. So
adding a `<Simulation>` with checkpoints or a `<Steps>` block gives learners more
to master — author them intentionally.

## Validate before committing

```bash
# fast per-file pre-check (frontmatter + references for one file)
node skills/lms-authoring-topics/scripts/validate.mjs topics/<subject>/<slug>.mdx

# canonical checks (what CI runs)
npm run validate:staging   # repo-wide, prod + staging
npm run gate               # what CI runs
```

Fix every error before opening a PR. Common failures: a `prerequisites`/`relatedTo`
id that doesn't exist, a `<Simulation id>` not in the registry, a `quiz.answer`
index out of range, or a missing required field.
