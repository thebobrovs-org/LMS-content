# Knowledge

What the team learned while making the lessons, kept where the next lesson can find it (LMS-content#87). Corrections and teaching insights used to live in PR threads and die there.

This is the smallest thing that could work: **Markdown records in three folders, and a habit.** No index, no retrieval tooling. If the folders fill up and people search them, an index is a later, cheap step; if they stay empty, we learned that without building anything.

## The three record types

| Folder | One record is… | Example |
|---|---|---|
| `claims/` | One checkable assertion, with its scope and its source | "Halving the bytes moved at a memory boundary doubles arithmetic intensity, if FLOPs and the other traffic are unchanged" |
| `misconceptions/` | An incorrect learner model, how it shows, and the example that corrects it | "Fewer bytes always means faster training" |
| `decisions/` | A choice about how we teach or build, the alternatives, and why | "A simulation serves an objective; it is not mandatory" |

Each record is one file, named by its slug, with this front matter:

```yaml
---
id: claim/precision-bytes-and-intensity   # <type>/<slug>, stable once merged
type: claim                               # claim | misconception | decision
status: approved                          # proposed | approved | disputed | superseded
scope: "AI accelerators; roofline reasoning at a stated memory boundary"
source: "Williams, Waterman, Patterson (2008), Roofline, §2"   # a locator, not just a title; or "team decision (LMS-content#86)"
touches: [math-infra/precision-and-memory]  # lessons, sims or notebooks that teach or depend on this
reviewed: 2026-09-12
---
```

Then the body: the claim in one sentence and its limits; or the misconception, how it was detected and the correcting example; or the decision, the alternatives and the reason. Keep a record to one idea. Link related records by id.

## The habit: the knowledge delta

Every content PR answers one line in its description, **Knowledge delta**: the records it adds or changes, or `none` with a word on why. "None" is a valid answer; the point is to ask, not to fill folders.

A record moves to `disputed` when a critic or a learner shows it wrong, and to `superseded` when a newer record replaces it (say which). A `disputed` claim that a published lesson depends on is a technical-accuracy finding on that lesson (`pipeline/AUDIT.md` §2).

## Rules

- Public repository: no learner data, no personal details, no internal reasons about people. Team-internal notes belong in the hub.
- A record is reviewed like content: the PR's technical-accuracy critic checks a claim's source and scope.
- Do not paste a lesson into a record. A record is what the lesson relies on, in one place.
