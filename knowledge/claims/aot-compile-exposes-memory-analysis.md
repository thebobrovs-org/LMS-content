---
id: claim/aot-compile-exposes-memory-analysis
type: claim
status: approved
title: "Ahead-of-time compilation returns an object whose memory analysis can be read before anything runs"
scope: "jax.jit(f).lower(...).compile()"
sources:
  - "JAX documentation, \"Ahead-of-time lowering and compilation\", docs.jax.dev/en/latest/aot.html (lower, compile, memory_analysis, cost_analysis)"
touches:
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#aot-facts
tags: [jax, compilation]
related:
  - concept/jax-compile-path
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**Claim.** `jax.jit(f).lower(*args).compile()` traces, lowers and compiles without executing. The compiled object exposes `memory_analysis()` and `cost_analysis()` (backend permitting), so the HBM a batch size or sharding will need can be read at compile time, before a slice is spent on a run that would fail to allocate.

**Limits.** The analyses are the compiler's estimates for that executable; runtime allocations outside it (input buffers, other programs on the device) are not in them. Availability of the analyses is per backend.
