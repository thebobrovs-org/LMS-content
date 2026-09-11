# LMS content

The learning content for **LMS** ([thebobrovs/LMS](https://github.com/thebobrovs/LMS))
— topics, paths, per-path glossaries, and media. The application repo checks this
out at build time (`scripts/fetch-content.mjs`) and renders it; nothing here is
application code.

## Layout

```
topics/<subject>/<slug>.mdx   # PROD lessons (published) = knowledge-graph nodes
paths/<id>.mdx                # curated tracks (levels 100/200/300) over topics
glossary/<pathId>.json        # per-path term → definition (+ optional link)
media/                        # images/diagrams, served at /media/…
simulations/packages/<id>/    # interactive sim apps embedded by <Simulation id>
staging/                      # DRAFTS awaiting audit + promotion
personas/                     # per-topic SME experts (who authors each topic)
skills/                       # authoring skills + the SME content pipeline
pipeline/                     # validate.mjs · promote.mjs · AUDIT.md
```

- A topic's `id` is its path under `topics/` without `.mdx`
  (e.g. `data-structures/hash-tables`).
- Reference images as `/media/<file>`.
- **Simulations live here too** (authored content). The host↔sim **SDK** stays in
  the app repo (the contract `Simulation.tsx` implements); the app's build copies
  it into each bundle and fetches `simulations/packages/` alongside `topics/`.

## Authoring

Frontmatter and the MDX component set (Simulation, YouTube, Callout, Flashcard,
Quiz, Steps, Figure, Tip, Term) are documented in this repo under
[`skills/`](skills/) — see `lms-authoring-topics`, `lms-authoring-paths`,
`lms-authoring-simulations`, and `sme-content-pipeline`. A per-file validator
lives there too:
`node skills/lms-authoring-topics/scripts/validate.mjs <file>`.

## Authoring pipeline (SME → staging → prod)

New topics are authored by a **subject-matter-expert persona**, drafted in
**staging**, **audited** (automated + human + sub-agent critics), then **promoted**
to production:

1. **Adopt the persona** for the topic (`personas/`, resolved by topic id →
   subject → `_default`). You are now that expert.
2. **Research → plan → draft** into `staging/topics/…` with `status: draft`
   (follow the `skills/sme-content-pipeline` + `skills/lms-authoring-topics`).
3. **Audit** — `node pipeline/validate.mjs --staging` (CI gate) + the
   `pipeline/AUDIT.md` critics + a human PR review (preview with a
   `CONTENT_STAGING=1` app build).
4. **Promote** — `node pipeline/promote.mjs staging/topics/<…>.mdx` first checks
   that production content, as it will be after the promotion, passes validation.
   Then it moves the file to `topics/` and sets `status: published`. It accepts
   only files in `staging/topics/`, replaces a published topic only with `--force`,
   and changes nothing if any step fails. Merge → the app rebuilds and the topic
   goes live.

```bash
npm install              # gray-matter for the validators
npm run validate         # validate prod content
npm run validate:staging # validate prod + staging
npm run promote -- staging/topics/<subject>/<slug>.mdx
```

Content-only changes never require an app code change. The app repo's CI also
re-validates after fetch (and checks simulation refs against its registry).

## Licence

- **Content** — the lessons, paths, glossaries, resources, media, personas, planning documents and skills — is licensed under [Creative Commons Attribution-ShareAlike 4.0 International](LICENSE) (CC BY-SA 4.0): reuse, adapt and translate it with attribution to this repository, and share derivatives under the same licence.
- **Code** — the schema, scripts, pipeline and simulation packages — is licensed under the [MIT License](LICENSE-CODE).

Third-party material referenced by resources and videos keeps its own licence.
