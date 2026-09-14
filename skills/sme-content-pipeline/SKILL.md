---
name: sme-content-pipeline
description: The end-to-end workflow for authoring an LMS topic as a subject-matter expert and promoting it from staging to production. Use when researching and creating a new topic (or substantially revising one) in the LMS-content repo. Covers adopting the topic's SME persona, researching from authoritative sources, writing a plan, drafting into staging/, running the human + sub-agent audit, and promoting to prod. Pairs with lms-authoring-topics (the format) and the personas/ briefs (the expert).
---

# SME content pipeline

How a new (or revised) topic goes from idea to live, authored by an expert and
gated by review. Three skills compose: **this** (the process), the **persona**
(who's writing — `personas/`), and **lms-authoring-topics** (the format).

## 0. Adopt the persona
Resolve the topic's SME: exact id → subject → `_default` in `personas/`. Read it.
You are now that expert — use their sources, standards, and voice.

## 1. Research: retrieve first, then read, then record
- **Retrieve before you write** (hyperstack ADR 0005): what the platform already
  established is in `knowledge/` and its index. Run it for the topic's neighbours
  and its key terms, and read every record that matches:
  ```bash
  node pipeline/knowledge-search.mjs --topic <prerequisite topic id>
  node pipeline/knowledge-search.mjs <key term> [<key term> …]
  node pipeline/knowledge-search.mjs --tag <tag>
  ```
  An approved record is a claim already checked against its source: build on it
  and cite its id; do not re-derive it. A `disputed` one is a warning.
- Gather the rest from the persona's authoritative sources. **Every non-obvious
  number/claim must be traceable** to one; note the citations.
- **Record before you draft.** A fact the lesson will rely on that no record
  holds becomes a record first (`knowledge/README.md`: `claim`, `concept` or
  `misconception`, status `proposed`, `sources` as locators, `provenance.origin:
  authoring`, `touches` the *existing* topics it concerns; the new lesson's id
  is added at promotion, since a staged topic does not resolve in production).
  Regenerate `knowledge/index.json`. The research is then on record before the
  lesson text exists, and the technical-accuracy critic reviews the records
  with the lesson.
- Identify prerequisites (existing topic ids) and where a simulation is the right
  way to "prove it."

## 2. Plan
Write a short plan (in the PR description or a `staging/<id>.plan.md`):
- learning objective, prerequisites, the arc, the simulation(s) + checkpoints,
  the flashcards/quiz/steps, and the sources: the **record ids** the lesson
  relies on (`claim/…`, `concept/…`) and the records it will add. Get it
  reviewed before drafting if the topic is large.

## 3. Draft into staging
- Author `staging/topics/<subject>/<slug>.mdx` with `status: draft`, following
  the `lms-authoring-topics` skill (frontmatter contract + component catalog).
- Put images in `media/`; define terms in the path's `glossary/<pathId>.json` (a topic resolves terms against the glossaries of the paths that contain it).
- Where the lesson states a fact a record holds, the PR's **Knowledge delta**
  names that record by id; a lesson's own sources list cites the record's
  source locator, the same one the record carries.
- Validate: `node pipeline/validate.mjs --staging`.

## 4. Audit (human + sub-agent critics)
Run the gate in `pipeline/AUDIT.md`. Spawn **independent critic sub-agents** —
one each for **technical accuracy**, **assessment validity**, **pedagogy &
clarity**, **voice/standard**, and **self-containment** — each returning
`pass` / `fail` / `needs-human-review` for its own dimension, with specifics.
Verdicts are never averaged or voted: **technical accuracy and assessment
validity must both pass**, whatever the others say; the rest follow AGREEMENT §3
after round two. Default to `needs-human-review` when uncertain; revise and
re-run the affected critic until the rule holds. Then a human reviewer previews
the draft (`CONTENT_STAGING=1` build), confirms the two blocking dimensions
passed on the current revision, and signs off on the PR.

## 5. Promote
- `node pipeline/promote.mjs staging/topics/<…>.mdx` → moves it to `topics/` and
  sets `status: published`.
- Add the promoted topic's id (and the objectives, items and steps it serves) to
  the `touches` of the records it relies on; `node pipeline/knowledge-index.mjs`;
  the Knowledge delta lists the ids.
- `node pipeline/validate.mjs`, commit, merge. The app rebuilds and the topic is
  live.

## Guardrails
- Don't promote content that fails `validate.mjs` or the audit.
- Don't invent figures — cite. Don't re-teach prerequisites — link them.
- A simulation serves a stated objective; when it does, the prose sets it up and interprets it. A concept that a figure or a worked example teaches better gets that instead (LMS-content#86; the blueprint's "Simulation?" decision).
