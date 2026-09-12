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

## 1. Research
- Gather facts from the persona's authoritative sources. **Every non-obvious
  number/claim must be traceable** to one; note the citations.
- Identify prerequisites (existing topic ids) and where a simulation is the right
  way to "prove it."

## 2. Plan
Write a short plan (in the PR description or a `staging/<id>.plan.md`):
- learning objective, prerequisites, the arc, the simulation(s) + checkpoints,
  the flashcards/quiz/steps, and the sources. Get it reviewed before drafting if
  the topic is large.

## 3. Draft into staging
- Author `staging/topics/<subject>/<slug>.mdx` with `status: draft`, following
  the `lms-authoring-topics` skill (frontmatter contract + component catalog).
- Put images in `media/`; define terms in the path's `glossary/<pathId>.json` (a topic resolves terms against the glossaries of the paths that contain it).
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
- `node pipeline/validate.mjs`, commit, merge. The app rebuilds and the topic is
  live.

## Guardrails
- Don't promote content that fails `validate.mjs` or the audit.
- Don't invent figures — cite. Don't re-teach prerequisites — link them.
- A simulation serves a stated objective; when it does, the prose sets it up and interprets it. A concept that a figure or a worked example teaches better gets that instead (LMS-content#86; the blueprint's "Simulation?" decision).
