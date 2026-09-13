---
name: lms-authoring-topics
description: Author or edit an LMS lesson topic — a single MDX file (one topic = one knowledge-graph node) with YAML frontmatter (metadata, graph edges, flashcards, quiz) and an MDX body (prose plus the whitelisted components Simulation, YouTube, Callout, Flashcard, Quiz, Steps). Use when creating a new lesson, editing an existing one, adding retrieval-practice items, or embedding a simulation/video into a lesson. Covers file location, the exact frontmatter contract, the component catalog, voice/tone, and how to validate.
---

# Authoring a lesson topic

A **topic** is one lesson: a single `.mdx` file that is also one node in the
knowledge graph. Prose, simulation, video, and recall items live together in that
one file so it reviews as a unit.

## Where it goes

```
content/topics/<subject>/<slug>.mdx
```

- The file path under `content/topics/` (without `.mdx`) IS the topic **`id`**,
  e.g. `content/topics/data-structures/hash-tables.mdx` → id `data-structures/hash-tables`.
- Folders are organizational only (subjects like `fundamentals/`, `systems/`,
  `ml-systems/`). **The real structure is the graph** (prerequisite/related
  edges), not the folders.
- Use kebab-case slugs. The `id` in frontmatter must equal the path.

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
`id` is derived from the path — set it only if you want to be explicit, and it
must match.

## The MDX body

Plain Markdown plus a **whitelisted** set of components (no arbitrary scripts):

- `<Simulation id="…" height={…} props={{…}} />` — embed an interactive sim. The
  `id` must exist in `content/simulations/registry.json` (build sims first).
- `<YouTube id="…" start={…} title="…" />` — privacy-friendly lazy video.
- `<Callout type="tip|note|warning">…</Callout>` — styled aside.
- `<Flashcard front="…" back="…" />` — inline recall card (also schedulable).
- `<Quiz question="…" choices={[…]} answer={0} explanation="…" />` — inline MCQ.
- `<Steps><Step title="…">…</Step></Steps>` — a tracked, numbered walkthrough;
  each step is a progress checkpoint that feeds topic mastery.
- `<Figure src="/media/…" alt="…" caption="…" />` — a framed, captioned image.
  Put files in `public/media/…`; bare Markdown `![alt](src)` also works (auto-styled).
  Prefer SVG for diagrams. `alt` is required.

Put a check (flashcard/quiz/step) right after the thing it tests — "do it, then
recall it."

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
- Items get a **stable id from a hash of the topic id + the prompt text**, so
  editing order is safe but editing the prompt resets that item's schedule.
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
node skills/lms-authoring-topics/scripts/validate.mjs content/topics/<subject>/<slug>.mdx

# canonical checks (what CI runs)
npm run validate-content
npm run build
```

Fix every error before opening a PR. Common failures: a `prerequisites`/`relatedTo`
id that doesn't exist, a `<Simulation id>` not in the registry, a `quiz.answer`
index out of range, or a missing required field.
