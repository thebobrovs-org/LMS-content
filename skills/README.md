# LMS authoring skills

[Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills) that
teach a content agent how to author for this LMS — what to write, where files go,
the exact frontmatter/MDX contract, and how to validate before opening a PR.

Each skill is a self-contained directory with a `SKILL.md` (its instructions),
plus `reference/`, `examples/`, `template/`, and `scripts/` as needed.

These skills live **in the content repo** (`LMS-content`) alongside the content
they govern. Authoring a lesson runs in this repo's root layout (`topics/`,
`paths/`, `glossary/`).

| Skill | Use it to… |
|-------|-----------|
| [`sme-content-pipeline`](sme-content-pipeline/SKILL.md) | The **end-to-end workflow**: adopt the topic's SME persona, research → plan → draft to `staging/` → audit → promote to prod. Start here for a new topic. |
| [`lms-authoring-topics`](lms-authoring-topics/SKILL.md) | Write or edit a **lesson** — one topic = one `.mdx` = one graph node. Frontmatter, MDX components, flashcards/quizzes, steps, images, glossary terms. |
| [`lms-authoring-paths`](lms-authoring-paths/SKILL.md) | Curate a **learning path** — group topics into ordered levels (100/200/300). |
| [`lms-authoring-simulations`](lms-authoring-simulations/SKILL.md) | Build an **embedded simulation** (they live here, in `simulations/packages/`; the app fetches and bundles them at build time). Only where the concept is dynamic or hard to picture; a figure or a worked example is the right choice otherwise. |
| [`lms-authoring-images`](lms-authoring-images/SKILL.md) | Generate a **topic illustration** (AI image) in the Hyperstack house style — the reusable style block, per-image subject template, and how to wire it into a lesson. |

See also [`../personas/`](../personas) (the SME experts) and
[`../pipeline/`](../pipeline) (`validate.mjs`, `promote.mjs`, `AUDIT.md`).

## The golden rule for any change

Author, then **validate before you commit**:

```bash
npm install                                  # gray-matter for the validators
node skills/lms-authoring-topics/scripts/validate.mjs <file>   # fast per-file check
node pipeline/validate.mjs --staging          # repo-wide (prod + staging) — the CI gate
```

## Using these with a coding agent

Each skill is a standard [Agent Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills)
(a `SKILL.md` with `name` + `description` frontmatter, plus supporting files).

- **Claude Code:** symlink or copy a skill into `.claude/skills/`, e.g.
  `ln -s ../../skills/lms-authoring-topics .claude/skills/lms-authoring-topics`,
  then it's available to the agent. The `description` controls when it triggers.
- **Other agents:** point your content agent at this directory; it reads the
  `SKILL.md`, follows the `reference/` and `examples/`, and runs the `scripts/`.

The skills live in the repo (not `.claude/`) so they're versioned with the
content contract they document and reviewed in the same PRs.

## How content reaches learners

All content is MDX/JSON authored here (or in the separate content repo in prod),
reviewed via **GitHub PR**, validated in CI, and compiled at build time. There is
no CMS and no runtime database for content — the files *are* the source of truth.
See `docs/02-architecture.md` and `docs/03-content-model.md` for the full picture.
