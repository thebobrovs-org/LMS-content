# Personas

Two kinds live here, distinguished by the `kind:` front-matter field:

- **SME author personas** (`kind` omitted) — the voice and standard an authoring
  agent adopts to research, plan, draft, and revise a topic. Content is written by
  a consistent "expert," not a generalist.
- **Audience reviewer personas** (`kind: audience-reviewer`) — the *target learner*
  a reviewer agent adopts to read finished or draft content and report where that
  reader gets lost. They judge **comprehensibility, not correctness** (the SME owns
  correctness). See [`audience-infra-engineer.md`](audience-infra-engineer.md), the
  reviewer for the `tpu-training-infra` path; it's wired to the `audience-reviewer`
  subagent (`.claude/agents/audience-reviewer.md`). Pass any new topic, simulation,
  or notebook to that subagent before shipping to surface undefined jargon, missing
  host/chip framing, and "so what for my job" gaps.

## SME author personas

Each topic has a **Subject-Matter Expert persona** — the voice and standard an
authoring agent adopts to research, plan, draft, and revise that topic. A persona
is a brief an agent loads (alongside the `sme-content-pipeline` skill) before it
touches a topic, so content is written by a consistent "expert," not a generalist.

## Files
- `_template.md` — copy this to start a new persona.
- `<topic-id-or-subject>.md` — one per topic (e.g. `ml-systems/tpu-v5p-topology.md`)
  or per subject (e.g. `data-structures.md`) when topics share an expert.

A topic resolves its persona by: exact topic id → else its subject → else the
`_default` persona (not yet written: a subject without a persona needs one before authoring).

## What a persona is for
The persona defines **who is writing**: their expertise, the authoritative
sources they trust, the standards they refuse to compromise on, and the voice
they use. The **process** they follow (research → plan → stage → audit → promote)
is in the `sme-content-pipeline` skill; the persona is the *expert* that runs it.

## How an agent uses one
1. Load the persona for the topic + the `sme-content-pipeline` skill.
2. Research from the persona's sources; write the plan; draft into `staging/`.
3. Spawn the audit critics (see `pipeline/AUDIT.md`); revise until they pass.
4. After human sign-off, promote to prod.
