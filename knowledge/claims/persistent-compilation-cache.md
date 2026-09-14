---
id: claim/persistent-compilation-cache
type: claim
status: approved
title: "The persistent compilation cache reuses compiled executables on later matching lookups, given storage every host can reach"
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

**Claim.** With the persistent compilation cache enabled (`jax_compilation_cache_dir`), a compiled executable is written to the cache directory and reused by a later process whose lookup matches it, so the backend compile is skipped on that lookup.

**Limits.**
- **Cold cache:** on the first run nothing is cached, so every participating process still compiles; the saving is on subsequent matching runs and restarts.
- **Across hosts:** reuse requires a cache directory every host can reach (shared storage such as a bucket); a host-local directory serves only that host.
- **Eligibility:** only compilations above the configured minimum compile time are persisted (`jax_persistent_cache_min_compile_time_secs`), so not every executable enters the cache.
- A hit needs the same JAX and XLA versions, compile options and shapes; the key includes them.
