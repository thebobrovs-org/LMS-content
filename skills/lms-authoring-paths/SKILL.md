---
name: lms-authoring-paths
description: Author an LMS learning path — a curated track that groups existing topics into ordered levels (100/200/300). Paths are a thin curation layer over the flat topic graph (they reference topic ids, never duplicate content). Use when creating or editing a guided track, organizing topics into a 100/200/300 progression, or building a course-like sequence. Covers the path file location, frontmatter shape, levels, and validation.
---

# Authoring a learning path

A **path** is a curated journey — it groups existing topics into ordered
**levels** (like 100/200/300 course tiers). Paths sit *on top of* the topic graph:
they reference topic ids, so a topic can appear in several paths and authoring a
path never copies lesson content.

## Where it goes

```
paths/<id>.mdx
```

The filename (without `.mdx`) is the path **`id`** and its URL: `paths/tpu.mdx`
→ `/paths/tpu`.

## Shape

```mdx
---
title: TPU Architecture
summary: From a single chip to an 8,960-chip pod and Multislice training.
levels:
  - level: 100
    title: Foundations
    topics:
      - ml-systems/tpu-what-is-a-tpu
  - level: 200
    title: Topology & scaling
    topics:
      - ml-systems/tpu-v5p-topology
      - ml-systems/tpu-slices
  - level: 300
    title: Parallelism in practice
    topics:
      - ml-systems/tpu-parallelism-mapping
status: published
---

A short prose intro to the path — what it covers and why, who it's for. This is
rendered as MDX above the levels, so the lesson components are available here too.
```

A full example is [examples/example-path.mdx](examples/example-path.mdx).

## Frontmatter contract (CI-enforced)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | Sentence case. |
| `summary` | string | yes | 1–2 sentences. |
| `levels` | Level[] | yes (≥1) | Ordered; render top to bottom. |
| `layout` | `levels`\|`chapters` | no (default `levels`) | `chapters`: each entry is a chapter, shown as "Chapter N" with no level tiers. |
| `status` | `draft`\|`published` | no (default `published`) | `draft` hidden in prod. |

**Level**: `level` (positive integer — the tier, e.g. 100/200/300), `title`
(string), `topics` (≥1 topic ids, in order).

**Chapters** (`layout: chapters`): for a path read straight through, one chapter
after another, with no depth tiers. Each entry is a chapter and its `level` is
just its number, 1, 2, 3 in order (the schema checks it). The app shows
"Chapter N" and the chapter's title, and the lesson page's progress timeline
follows one chapter. `paths/gcp-agentic-architect.mdx` is one. Reordering or
regrouping lessons never touches learners' progress, which is keyed by topic and
item, not by level or chapter.

## Rules

- **Every topic id in every level must exist** (a real `topics/**.mdx`).
  This is checked by `pipeline/validate.mjs` (part of `npm run gate`).
- Order matters: levels render in array order; topics render in list order.
- A topic's own optional `level` frontmatter field can echo its tier for a badge,
  but the path's grouping is what drives the path page.
- Progress is automatic: the path page rolls up each topic's mastery into an
  "X/N lessons mastered" bar — you don't author any progress state.

## How it maps to "TPU → 100/200/300 → sub-topics → steps"

- **Path** = the track (`tpu.mdx`).
- **Level** = a tier (100/200/300) inside the path.
- **Sub-topic** = each topic id in a level (its own `topics/**.mdx` lesson).
- **Steps** = authored *inside* a lesson with `<Steps>` (see `lms-authoring-topics`).

So splitting a big subject into "101 / 201 / 301" means writing several small
topic files and listing them under the path's levels — no new infrastructure.

## Validate

```bash
node skills/lms-authoring-topics/scripts/validate.mjs paths/<id>.mdx
npm run gate
```
