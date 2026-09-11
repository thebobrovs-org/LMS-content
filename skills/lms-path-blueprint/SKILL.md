---
name: lms-path-blueprint
description: Plan a learning path BEFORE building it — a one-page path TLDR (why/what/how + topic map), then a per-topic plan for EVERY topic (learning objectives, key terms, must-learn, and exactly what simulation or figures it needs), agreed as a full map before any topic MDX is written. Use when starting or restructuring a path, or before authoring topic content. Enforces the rule: no topic is created before its plan exists and the full map is signed off; then build topic-by-topic with a sign-off gate between each.
---

# Planning a learning path (blueprint-first)

A path is **planned in full before any topic is authored**. We design the map,
agree on it, then build topic by topic — each to its plan, each signed off before
the next. The hard rule:

> **No topic file (MDX) is created before its plan exists, and no topic is
> authored until the whole map is agreed.** We continue only when we're happy.

These planning docs are *not* shipped content. The lessons (MDX), sims, and
glossary are built later, each from its plan, using `lms-authoring-topics`,
`lms-authoring-simulations`, and `sme-content-pipeline`.

## Where the planning docs live

```
planning/<path-id>/
  path.md                      # the PATH TLDR — why / what / how + the topic map
  topics/<level>-<slug>.md     # one PLAN per topic (objectives, key terms, sim/figures…)
```

## The process — gates, in order

**1. Path TLDR** (`path.md`) — the whole path on one page: audience, the outcome
(definition of done), **why / what / how**, and an ordered **topic map** (each row:
id · level · one-line objective · lab/visual type · status). Agree this first.
Template: [templates/path-tldr.md](templates/path-tldr.md).

**2. Per-topic plans** (`topics/*.md`) — for **every** topic in the map, write a
plan *before* authoring anything. Template: [templates/topic-plan.md](templates/topic-plan.md).
Each plan must answer:

- **Why / What / How** — the topic's arc in three lines.
- **Learning objectives** — what the learner can *do* afterwards (action verbs).
- **Must-learn** — the 2–4 non-negotiable takeaways (if they keep nothing else).
- **Key terms** — the glossary entries this topic introduces.
- **Builds on / sets up** — prerequisites, and which later topics it enables.
- **Visualization plan** *(the important one)* — decide deliberately:
  - **Simulation?** Only when the concept is *dynamic / hard to picture* (a
    process unfolding, a trade-off you tune). Name the **complex concept it must
    make concrete**, the **interaction**, and the `observe-*` checkpoint. (Follow
    `lms-authoring-simulations` — rich but clean.)
  - **Figures/images?** When a *static* picture explains it (an architecture
    diagram, a layout). List each figure.
  - **Neither?** Some topics are prose + code. That's fine — say so.
  - **Lab type:** if the topic has a hands-on lab, mark it **sim** (browser, we
    build it) or **codelab** (real cloud, we link it).
- **Assessment** — what the flashcards and quiz should test.
- **Size** — difficulty + estimated minutes.

**3. Full-map gate** — do **not** author any topic until `path.md` *and* **all**
topic plans exist and are signed off. The map is complete and agreed first. This
is what prevents half-built paths and topics that don't connect.

**4. Build loop** — author topics one at a time, foundations-first, each strictly
to its plan: author → `node pipeline/validate.mjs` → the 4 audit critics
(`pipeline/AUDIT.md`) → review on staging. **Do not start the next topic until the
current one is signed off.**

**5. Plan is the contract** — if a built topic needs to drift from its plan,
update the plan and re-agree; don't silently diverge. Keep the plan and the lesson
in sync.

## Status tracking

`path.md`'s topic map carries a **status** per topic so the map always shows where
we are: `planned → plan-approved → in progress → on staging → signed off → published`.
A topic with no approved plan is **not** ready to build.

## Why this exists

It separates *what to teach and why* (the plan, where disagreements are cheap to
fix) from *building it* (expensive). It guarantees every topic has agreed
objectives, a deliberate decision about whether it needs a sim or a figure, and a
place in a coherent map — before a line of MDX is written.
