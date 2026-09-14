---
id: claim/persistent-compilation-cache
type: claim
status: approved
title: "JAX's persistent compilation cache lets every host reuse one compile"
scope: "Multi-host JAX jobs"
sources:
  - "JAX documentation, \"Persistent compilation cache\", docs.jax.dev/en/latest/persistent_compilation_cache.html"
touches:
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#stack-pieces
tags: [jax, compilation]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**Claim.** With the persistent compilation cache enabled (a cache directory configured through `jax_compilation_cache_dir`), compiled executables are written to storage and reused by later processes with the same program and configuration, so a multi-host job does not pay the compile once per host or once per restart.

**Limits.** A cache hit needs the same JAX and XLA versions, the same compile options and the same shapes; the cache is keyed on them.
