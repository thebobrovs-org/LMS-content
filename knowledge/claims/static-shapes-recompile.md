---
id: claim/static-shapes-recompile
type: claim
status: approved
title: "Accelerator programs have static shapes: a new input shape retraces and recompiles"
scope: "jax.jit-compiled functions"
sources:
  - "JAX documentation, \"Just-in-time compilation\", docs.jax.dev/en/latest/jit-compilation.html (tracing with abstract values; caching and retracing)"
touches:
  - math-infra/tensor-shapes
  - objective:math-infra/tensor-shapes#surprise-oom
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#compile-path
tags: [jax, compilation]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**Claim.** A jitted function is traced with abstract values that carry shape and dtype, not data; the compiled executable is specialised to those shapes and cached by them. Calling it with a new shape or dtype triggers a new trace and compile. That is the "why did my step get slow after I changed the batch size" effect, and the reason shapes are frozen before any memory is planned.

**Limits.** Values marked static (`static_argnums`) also key the cache; some shape polymorphism exists for export, but the executable run on the device is still shape-specialised.
