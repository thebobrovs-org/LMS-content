# Knowledge

The platform's shared knowledge base (hyperstack ADR 0005; started as LMS-content#87's three folders): what the team and its agents established while making the lessons, and what learners asked, kept where the next lesson, the authoring agent and, later, the mentor can find it. Every record says what it touches in the curriculum, where it came from, who wrote it, when it was reviewed and when to look again. Corrections and teaching insights used to live in PR threads and die there.

**Markdown records in five folders, a schema the gate checks, and an index the gate generates.** No database; git gives every record its author, diff, reviewer and date.

## The record types

| Folder | Type | One record is… | Example |
|---|---|---|---|
| `concepts/` | `concept` | One explanation: the idea, its relationships, canonical terms, a worked example | "Arithmetic intensity and the boundary it is measured at" |
| `claims/` | `claim` | One checkable assertion, with its scope and its sources | "Halving the bytes moved at a memory boundary doubles arithmetic intensity, if FLOPs and the other traffic are unchanged" |
| `misconceptions/` | `misconception` | An incorrect learner model, how it shows, and the example that corrects it | "Fewer bytes always means faster training" |
| `decisions/` | `decision` | A choice about how we teach or build, the alternatives, and why | "A simulation serves an objective; it is not mandatory" |
| `questions/` | `question` | A question a learner or an agent asked, **anonymised**, with the answer, what supports it, and what was missing when it was asked | "Why does bf16 keep fp32's range?" |

Each record is one file, `knowledge/<folder>/<slug>.md`, with this front matter (`schema/knowledge-schema.mjs`; unknown fields are refused):

```yaml
---
id: claim/precision-bytes-and-intensity   # <type>/<slug>; equals the folder and file name; stable once merged
type: claim                               # concept | claim | misconception | decision | question
status: approved                          # proposed | approved | disputed | superseded
title: "Precision, bytes and arithmetic intensity"   # optional; the slug, humanised, otherwise
scope: "Roofline reasoning at one stated memory boundary, for a kernel whose FLOPs are fixed"
sources:                                  # locators, never bare titles; required once approved
  - "Williams, Waterman, Patterson (2008), Roofline, EECS-2008-134, §2–3"
touches:                                  # what in the curriculum relies on this, by stable id
  - math-infra/precision-and-memory                     # a lesson (topic id)
  - objective:math-infra/precision-and-memory#intensity # one of its objectives
  - item:math-infra/precision-and-memory#halving-bytes  # a review item: its id, a former id or its prompt hash (ADR 0004)
  - step:ml-systems/jax-xla-stack:trace                 # a lesson step
  - sim:arithmetic-intensity-calculator                 # a simulation
  - checkpoint:arithmetic-intensity-calculator/observe-bound   # one of its checkpoints (a former id counts)
tags: [roofline, precision]               # optional
related: [misconception/fewer-bytes-faster-training]   # optional: records this builds on or corrects
provenance:                               # where it came from
  origin: authoring                       # question | authoring | review | promotion
  by: agent:claude                        # human, or agent:<name>
  model: claude-fable-5-1                 # when an agent wrote it
  from: "LMS-content#86"                  # the question record, PR or issue it came from
reviewed: 2026-09-12
review-by: 2027-09-12                     # 90 days for vendor and API facts, a year for stable concepts
---
```

Then the body: the claim in one sentence and its limits; the concept and its worked example; the misconception, how it was detected and the correcting example; the decision, the alternatives and the reason; the question, its answer and what supports it. Keep a record to one idea. Link related records by id, `[claim/x](../claims/x.md)`; the index carries links both ways.

## What the gate checks (`pipeline/validate.mjs`)

- Every record matches the schema and lives at `<folder>/<slug>.md` under its own id.
- Every `touches` reference resolves against the curriculum the validator has just loaded: the topic exists (in production, for the production run), the objective is declared, the item or step is known under a current or former id, the simulation and its checkpoint exist. A record about a staged lesson waits for the lesson's promotion.
- An `approved` record names at least one source. Ids are unique; a title that reads like another record's warns (one idea, one record).
- A `disputed` record that a published lesson depends on names the open issue on that lesson (`disputed-by: owner/repo#n`); the validator refuses the status otherwise. That is a technical-accuracy finding on the lesson (`pipeline/AUDIT.md` §2).
- A `superseded` record names the record that replaces it.
- A `question` record carries no person: an e-mail address or an @handle in it is refused. Rewrite the question without the asker; the learner's own words and identity stay in their space, never here (this repository is public).
- Records past `review-by` are listed as warnings on every run, never hidden.

## Status changes

- A record is born `proposed`, by a PR like any content change. Anyone, including an agent, may propose.
- It becomes **`approved` only through a PR that carries Codex's technical-accuracy verdict on the record** (the content review path, `pipeline/AUDIT.md`): the source locators are opened and the scope checked. An agent's confidence is not a review.
- It moves to `disputed` when a critic or a learner shows it wrong, with the issue named as above, and to `superseded` when a newer record replaces it (`superseded-by`).

## The index

`knowledge/index.json` is generated by `node pipeline/knowledge-index.mjs` from the **approved** records only: ids, types, titles, scopes, tags, what they touch, their sources and review dates, and the links between them both ways. The gate checks it is current (`--check`); regenerate and commit it with any record change. A `proposed` record is visible here, in the repository, as any PR is; it never reaches the index or the app.

## The habit: the knowledge delta

Every content PR answers one line in its description, **Knowledge delta**: the records it adds or changes, by id, or `none` with a word on why. "None" is a valid answer; the point is to ask, not to fill folders. The authoring skills retrieve from the index before they write, and land their research as records before the lesson.

## Rules

- Public repository: no learner data, no personal details, no internal reasons about people. Team-internal notes (teaching patterns about learners, experiment and QA lessons) belong in the hub's private `knowledge/`.
- A record is reviewed like content: the PR's technical-accuracy critic checks a claim's source and scope.
- Do not paste a lesson into a record. A record is what the lesson relies on, in one place.
