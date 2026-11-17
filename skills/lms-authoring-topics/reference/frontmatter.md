# Topic frontmatter reference

The exact contract, mirroring `schema/content-schema.mjs` (the zod source of truth, hyperstack ADR 0001).
Frontmatter is YAML between `---` fences at the top of the `.mdx` file.

## Fields

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `id` | — | never | path | Derived from the file path under `topics/` without `.mdx`. **Not allowed in frontmatter**: the schema is strict and rejects it. |
| `title` | string | **yes** | — | Sentence case. Shown on cards, the lesson header, the graph. |
| `summary` | string | **yes** | — | 1–2 sentences. Powers cards, search snippets, graph tooltips. |
| `tags` | string[] | **yes** (≥1) | — | Drives filtering and related suggestions, e.g. `[data-structures, hashing]`. |
| `difficulty` | enum | **yes** | — | `beginner` \| `intermediate` \| `advanced`. |
| `estimatedMinutes` | int > 0 | **yes** | — | Shown to learners; used to estimate path length. |
| `level` | int > 0 | no | — | Optional curriculum tier (100/200/300) for path grouping + a badge. |
| `prerequisites` | string[] | no | `[]` | Directed edges **into** this topic. Every id must exist (CI-checked). |
| `relatedTo` | string[] | no | `[]` | Undirected edges. Every id must exist. A pair already linked by a prerequisite is **not** double-drawn. |
| `videos` | Video[] | no | `[]` | See below. |
| `flashcards` | Flashcard[] | no | `[]` | See below. |
| `quiz` | QuizItem[] | no | `[]` | See below. |
| `status` | enum | no | `published` | `draft` is excluded from production builds (hidden in prod, visible in dev). |
| `updated` | string | no | — | ISO date, optional. |
| `authors` | string[] | no | `[]` | GitHub handles, optional. |

## Nested shapes

**Video**
```yaml
videos:
  - youtubeId: dQw4w9WgXcQ   # required
    title: Hashing explained # optional
    start: 90                # optional, seconds, integer ≥ 0
```

**Flashcard**
```yaml
flashcards:
  - front: <prompt>   # required, non-empty
    back: <answer>    # required, non-empty
```

**QuizItem**
```yaml
quiz:
  - question: <prompt>            # required
    choices: [<a>, <b>, <c>]      # required, ≥2 strings
    answer: 0                     # required, 0-based index into choices, in range
    explanation: <why>            # optional
```

## Rules CI enforces (`npm run gate`, via `pipeline/validate.mjs`)

1. **Schema** — required fields present; enums and types valid.
2. **Referential integrity** — every `prerequisites`/`relatedTo` id resolves to an existing topic (no dangling edges).
3. **Acyclic prerequisites** — a topic can't be its own ancestor (the prerequisite subgraph must be a DAG).
4. **Simulation refs** — every `<Simulation id="…">` in the body resolves to a package in `simulations/packages/<id>/`.
5. **Quiz sanity** — `answer` is a valid index into `choices`.

> The fast JS validator (`scripts/build-graph.mjs`) mirrors the critical rules;
> `npm run gate` runs the canonical Zod validation. If the fast check
> passes but the build fails, trust the build.
