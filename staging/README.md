# staging/

Drafts live here until they pass audit and are promoted to production.

```
staging/topics/<subject>/<slug>.mdx   # status: draft
staging/<id>.plan.md                   # optional research plan
```

- Authored by the topic's **SME persona** (`../personas/`) following the
  **`sme-content-pipeline`** skill.
- Validated by `node pipeline/validate.mjs --staging` and the Content CI gate.
- Previewable in the app with a `CONTENT_STAGING=1` build.
- Promoted with `node pipeline/promote.mjs staging/topics/<…>.mdx`. It first checks
  that production content still validates with the promoted topics, including
  their prerequisites. Then it moves the file to `topics/` and sets
  `status: published`. Only files in `staging/topics/` are accepted, and a
  published topic is replaced only with `--force`.

Nothing in `staging/` is served in production — the app only fetches `topics/`.
