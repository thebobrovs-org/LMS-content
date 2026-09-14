---
id: concept/jax-compile-path
type: concept
status: approved
title: "From a Python function to a TPU executable: trace, jaxpr, StableHLO, XLA"
scope: "The JAX compilation pipeline"
sources:
  - "JAX documentation, \"Just-in-time compilation\", docs.jax.dev/en/latest/jit-compilation.html (tracing with abstract values; caching and retracing)"
  - "JAX documentation, \"Understanding jaxprs\", docs.jax.dev/en/latest/jaxpr.html"
  - "OpenXLA, StableHLO specification, openxla.org/stablehlo/spec (a portable, versioned operation set)"
  - "OpenXLA, \"XLA architecture\", openxla.org/xla/architecture (fusion of elementwise operations)"
touches:
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#compile-path
  - sim:xla-fusion-explorer
  - checkpoint:xla-fusion-explorer/observe-fusion
tags: [jax, xla, compilation]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**Concept.** `jax.jit` runs the Python function once on the host with abstract tracers, recording every primitive into a **jaxpr** (JAX's own intermediate representation). The jaxpr is lowered to **StableHLO**, a portable, versioned operation set. **XLA** compiles the StableHLO for the target, fusing operations and planning memory, and emits an executable that is shipped to the device. The device is idle until the executable arrives.

**Relationships.** Tracing is why shapes are static ([claim/static-shapes-recompile](../claims/static-shapes-recompile.md)); fusion is the compiler's main lever on bytes ([claim/xla-fusion-keeps-intermediates-on-chip](../claims/xla-fusion-keeps-intermediates-on-chip.md)); the same path runs ahead of time ([claim/aot-compile-exposes-memory-analysis](../claims/aot-compile-exposes-memory-analysis.md)).

**Canonical terms.** tracing, jaxpr, lowering, StableHLO, XLA, executable.
