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

**Claim.** `jax.jit(f).lower(*args).compile()` traces, lowers and compiles without executing. The compiled object exposes `memory_analysis()` and `cost_analysis()` (backend permitting), so the HBM an executable needs for a batch size or sharding can be read at compile time, before a slice is spent on a run that would fail to allocate.

**What the memory analysis reports.** The executable's argument buffers (`argument_size_in_bytes`), its outputs, its temporaries and the aliased buffers, as the compiler estimates them for that executable. Inputs are therefore included; do not add them again.

**Limits.** Outside the estimate: other live arrays on the device, other executables, and allocator or runtime overhead. The analyses are per backend; where a backend does not provide them the call returns nothing useful.
