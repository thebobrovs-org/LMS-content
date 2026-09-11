# AGENTS.md: LMS-content (lessons, paths, simulations)

**Team rules:** [thebobrovs/hyperstack AGREEMENT.md](https://github.com/thebobrovs/hyperstack/blob/main/AGREEMENT.md). The hyperstack repo is private; the agents use the local copy at `../hyperstack/AGREEMENT.md`. This file only covers what's specific to this repo.

> **This repo is public.**
> - Never commit secrets, internal notes or personal data.
> - **Security issues are filed in the private `thebobrovs/hyperstack` repo**, never here.
> - External reporters use GitHub private vulnerability reporting (see `SECURITY.md`).

## What this is

The learning content for Hyperstack:

| Path | Contents |
|---|---|
| `topics/**` | MDX lessons |
| `paths/*.mdx` | Learning paths |
| `glossary/`, `resources/` | Per-path JSON |
| `media/` | Images |
| `simulations/packages/*` | Interactive simulations: classic JS with `sim.config.json` |
| `notebooks/` | Companion Colab notebooks |
| `schema/` | The content schema (zod) and its generated declarations |
| `pipeline/` | Validation (against the schema, plus links, glossaries, media, simulations and an MDX compile) and the staging → prod promotion |
| `skills/` | Authoring guides |

The learner app (LMS) fetches this repo at build time.

## Commands

| Command | What |
|---|---|
| `npm ci` | Install |
| `npm run gate` | **The gate**: CI and `hyperstack/bin/pre-pr` run exactly this |
| `npm run validate` / `validate:staging` | Content validation |
| `../hyperstack/bin/pre-pr` | Adds a **build of LMS against this checkout**, so contract breaks show up before merge |

## Invariants (breaking one is a blocking review finding)

- **`schema/content-schema.mjs` is the contract** (hyperstack ADR 0001): every shape the app reads, in one zod module that content CI, the app build and the admin editor all use. Every object is strict, and `id` is never in a file's frontmatter (the app derives it from the path). `schema/content-schema.d.mts` is generated from it by `scripts/schema-declarations.mjs`, never edited by hand; the gate fails if it's out of date. Bump `SCHEMA_VERSION` when a change needs a consumer change. The local gate still builds LMS against this checkout, until LMS#76 makes the app consume this module.
- **Frontmatter is YAML only** (`---`), never `---js` or other engines. MDX is prose plus the documented components and plain prose HTML (`pipeline/validate.mjs` lists the elements and attributes), with no JavaScript: an expression carries literal data only, and a link or image points at a same-site path, http(s) or mailto.
- **Simulations:**
  - classic scripts, no CDNs or external loads, and they talk to the host only through the sim SDK;
  - keep them keyboard-operable;
  - don't run animation loops while idle or hidden.
- **Checkpoint ids are stable.** Renaming one silently erases the progress learners already made.
- **Accuracy:** hardware and ML-systems numbers cite a primary source in the PR. Codex reviews technical accuracy.

## `risk:high` paths

`pipeline/**` · `.github/**` · `scripts/gate.sh` · `.audit-allowlist.json` · checkpoint changes in `simulations/packages/*/sim.config.json` · dependency upgrades
