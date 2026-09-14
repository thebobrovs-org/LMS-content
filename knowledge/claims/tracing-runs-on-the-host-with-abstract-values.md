---
id: claim/tracing-runs-on-the-host-with-abstract-values
type: claim
status: approved
title: "Tracing and compilation run on the host CPU with abstract values; the accelerator idles until the executable is ready"
scope: "jax.jit on a TPU VM"
sources:
  - "JAX documentation, \"Just-in-time compilation\", docs.jax.dev/en/latest/jit-compilation.html (tracing with abstract values; caching and retracing)"
touches:
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#compile-path
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

**Claim.** On the first call, JAX evaluates the function with tracers that stand in for arrays (shape and dtype, no values), so the trace and XLA's compile consume host CPU and RAM. The TPU receives work only once the compiled executable is transferred to it.

**Limits.** Two caches avoid different stages. An **in-process JIT cache** hit (the same function called again with the same shapes and dtypes in the same process) bypasses tracing, lowering and compilation. A **persistent compilation cache** hit ([claim/persistent-compilation-cache](../claims/persistent-compilation-cache.md)) still traces and lowers the function, because the lookup key is computed from the lowered computation; it skips the backend compile only.
