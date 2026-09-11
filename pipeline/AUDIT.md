# Audit checklist (staging → prod gate)

Before a staged topic is promoted, it passes an **automated gate** and a
**human + sub-agent review**.

## 1. Automated (CI, blocking)
- `node pipeline/validate.mjs --staging` is green: frontmatter contract, graph
  integrity (prereq/related exist, no dangling), quiz answer ranges, and every
  `<Term>` resolves in the topic's path glossary.

## 2. Sub-agent critics (spawned per the `sme-content-pipeline` skill)
Each returns pass/fail with specifics; promotion needs a majority pass:
- **Technical accuracy** — every claim, number, and Big-O is correct and current; sources cited.
- **Pedagogy** — clear progression; the simulation is the centerpiece; checks (flashcards/quiz/steps) follow the thing they test.
- **Voice & standard** — plain, confident, sentence-case, no emoji; matches the design-system content rules.
- **Self-containment** — prerequisites are real; links/terms resolve; difficulty/level are honest.

## 3. Human review
- The PR reviewer (CODEOWNER) reads the rendered draft (preview build with
  `CONTENT_STAGING=1`) and signs off, or requests changes.

## 4. Promote
- `node pipeline/promote.mjs staging/topics/<…>.mdx` first validates production
  content as it will be after the promotion, in a scratch copy. Then it moves the
  file to `topics/` and sets `status: published`.
- It changes nothing if that validation fails, if a path is outside `staging/topics/`,
  or if it would replace a published topic. Pass `--force` to replace one on purpose.
- If a write fails midway, the files already moved are put back.
- Commit; merge. The app rebuilds and the topic goes live.
