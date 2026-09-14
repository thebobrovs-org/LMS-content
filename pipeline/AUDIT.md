# Audit checklist (staging → prod gate)

Before a staged topic is promoted, it passes an **automated gate** and a
**human + sub-agent review**.

## 1. Automated (CI, blocking)
- `node pipeline/validate.mjs --staging` is green: frontmatter contract, graph
  integrity (prereq/related exist, no dangling), quiz answer ranges, and every
  `<Term>` resolves in the topic's path glossary.

## 2. Sub-agent critics (spawned per the `sme-content-pipeline` skill)
Each critic owns **one dimension** and returns `pass`, `fail` or
`needs-human-review` for it, with specifics (quote the passage, say what is
wrong, propose the repair). Verdicts are **not averaged or voted**: a high
score elsewhere never cancels a failure (LMS-content#84).

- **Technical accuracy** — every claim, number, and Big-O is correct and current; sources cited; the simulation and notebook agree with the prose; the `knowledge/` records the lesson relies on or adds (the PR's Knowledge delta) are checked with it, source locators opened, and a record moves to `approved` only on this verdict. **A verified factual error blocks promotion on its own.**
- **Assessment validity** — every quiz question and flashcard is solved independently and compared with the key; one defensible answer per question; distractors plausible; explanations correct; each check tests what the lesson taught, not its wording. **A wrong or ambiguous key blocks promotion on its own.**
- **Pedagogy & clarity** — clear progression; every symbol and term defined or linked before use; a simulation, figure or worked example serves a stated objective (a lesson without a simulation is fine when a figure or a worked example does the job); checks (flashcards/quiz/steps) follow the thing they test.
- **Voice & standard** — plain, confident, sentence-case, no emoji; matches the design-system content rules.
- **Self-containment** — prerequisites are real and declared; links/terms resolve; difficulty/level are honest.

**Release rule.** Technical accuracy and assessment validity must both be
`pass` before promotion, in every round. The other three follow AGREEMENT §3:
exhaustive in round one; from round three on, only a finding that blocks an
essential objective still blocks, and the rest are fixed or filed. A
`needs-human-review` on any dimension goes to the human reviewer with the
critic's specifics. Default to `needs-human-review` when uncertain.

## 3. Human review
- The PR reviewer (CODEOWNER) reads the rendered draft (preview build with
  `CONTENT_STAGING=1`) and signs off, or requests changes.
- The reviewer confirms the two blocking dimensions have a `pass` from the
  current revision (a change to the lesson, an answer key or a simulation after
  the verdict means the critic runs again on that dimension), and resolves any
  `needs-human-review` with a written reason on the PR.

## 4. Promote
- `node pipeline/promote.mjs staging/topics/<…>.mdx` first validates production
  content as it will be after the promotion, in a scratch copy. Then it moves the
  file to `topics/` and sets `status: published`.
- It changes nothing if that validation fails, if a path is outside `staging/topics/`,
  or if it would replace a published topic. Pass `--force` to replace one on purpose.
- If a write fails midway, the files already moved are put back.
- Commit; merge. The app rebuilds and the topic goes live.
