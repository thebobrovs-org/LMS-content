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
| `knowledge/` | The platform wiki (hyperstack ADR 0005): Markdown records (concept, claim, misconception, decision, question) with sources, provenance and the curriculum ids they touch; `index.json` is generated from the approved ones |

The learner app (LMS) fetches this repo at build time.

## Commands

| Command | What |
|---|---|
| `npm ci` | Install |
| `npm run gate` | **The gate**: CI and `hyperstack/bin/pre-pr` run exactly this |
| `npm run validate` / `validate:staging` | Content validation |
| `../hyperstack/bin/pre-pr` | Adds a **build of LMS against this checkout**, so contract breaks show up before merge |
| `node scripts/merge-plan.mjs <pr>...` | Plans merging a batch of PRs: which merge together as they are, which wait for main and a CI re-run |

## Invariants (breaking one is a blocking review finding)

- **`schema/content-schema.mjs` is the contract** (hyperstack ADR 0001): every shape the app reads, in one zod module that content CI, the app build and the admin editor all use. Every object is strict, and a **topic's** `id` is never in its frontmatter (the app derives it from the path); a quiz item, a flashcard or a `<Step>` may carry its own `id` and `formerIds` (ADR 0004 in the hub): a rewording keeps the id, a change of meaning gets a new one, a rename lists the old id; the schema itself refuses a duplicate id or a stolen former id among the frontmatter's items (so the admin editor shows it, LMS-admin#54), and the validator refuses them across the body too, treats an identified item's prompt hash as a former id it claims, and warns (`--base`) when a prompt changes on an item without an id. `schema/content-schema.d.mts` is generated from it by `scripts/schema-declarations.mjs`, never edited by hand; the gate fails if it's out of date. Bump `SCHEMA_VERSION` when a change needs a consumer change. The local gate still builds LMS against this checkout, until LMS#76 makes the app consume this module.
- **Frontmatter is YAML only** (`---`), never `---js` or other engines. MDX is prose plus the documented components and plain prose HTML (`pipeline/validate.mjs` lists the elements and attributes), with no JavaScript: an expression carries literal data only, and a link or image points at a same-site path, http(s) or mailto.
- **Simulations:**
  - classic scripts, no CDNs or external loads, and they talk to the host only through the sim SDK;
  - keep them keyboard-operable;
  - don't run animation loops while idle or hidden.
- **Checkpoint ids are stable.** Renaming one silently erases the progress learners already made.
- **Knowledge records are reviewed like content** (`knowledge/README.md`): a record becomes `approved` only through a PR with the review agent's technical-accuracy verdict (currently agy, posted as the required review status); every `touches` reference resolves against the curriculum; a `disputed` record a published lesson depends on names the open issue; a `question` record carries no person; `knowledge/index.json` is generated (`pipeline/knowledge-index.mjs`), never edited.
- **Accuracy:** hardware and ML-systems numbers cite a primary source in the PR. The review agent (currently agy) reviews technical accuracy.

## Merging a batch of PRs

Merging is the PO's call: never merge without their go-ahead. Once they say go on a batch, don't merge main into every PR and wait for CI before the next one. Only PRs that share files wait on each other:

1. Every PR in the batch is green and approved as it stands. Run `node scripts/merge-plan.mjs <numbers...>`; it reads only git and prints rounds.
2. **Round 1** merges together, as the PRs are: no file in one is touched by another, and main hasn't changed their files or the gate since their base.
3. **Each later round** holds PRs that share a file with an earlier one (a glossary, a path, `knowledge/index.json`) or whose base is stale: merge main into each, wait for green CI, then merge that round together. PRs within a round share no files, so they update and run CI in parallel.
4. **Alone, last, one at a time:** a PR that changes the gate (`pipeline/`, `schema/`, `scripts/`, `.github/`, `package*.json`) or deletes or renames a file, since other files may link to it.
5. After the last merge, check that CI on main is green. It re-runs the full gate on the merged result, so it catches what disjoint files can't rule out (a link or glossary term one PR removes and another uses, the same item id in two files). If it's red, fix forward at once, because a red main doesn't redeploy staging.

Staging redeploys itself: when CI on main passes, its `content-merged` job dispatches the LMS Deploy workflow with the new commit (`scripts/notify-app.mjs`, secret `LMS_DISPATCH_TOKEN`). Concurrent staging deploys collapse to the newest, so a batch costs one wait, not one per PR. Production never deploys from this repo: it serves the content pinned in `LMS/content.lock.json` and moves only by a PR there plus the PO's manual promotion.

## Building simulations with three agents

Codex, agy and Claude build sims in parallel from [`simulations/BRIEFS.md`](simulations/BRIEFS.md). Before you start one, read [`skills/lms-authoring-simulations/SKILL.md`](skills/lms-authoring-simulations/SKILL.md). It says how to claim a brief (a draft PR titled `[sim:<id>]`), name the branch, get the PO's yes on the concept and the preview, and cross-review: the other two agents each post `Review by <agent>: APPROVE` or `CHANGES`. Only the PO merges.

## `risk:high` paths

`pipeline/**` · `.github/**` · `scripts/gate.sh` · `.audit-allowlist.json` · checkpoint changes in `simulations/packages/*/sim.config.json` · dependency upgrades
