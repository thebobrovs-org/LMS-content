---
id: concept/jax-stack-and-its-siblings
type: concept
status: approved
title: "JAX is the floor; Flax, Optax, Orbax and Grain are libraries beside it, not rungs beneath it"
scope: "The JAX ecosystem as an operator meets it"
sources:
  - "Flax documentation, flax.readthedocs.io (\"Flax NNX\" as the recommended API; Linen as the previous one)"
  - "Optax documentation, optax.readthedocs.io (composable gradient transformations)"
  - "JAX documentation, \"Just-in-time compilation\", docs.jax.dev/en/latest/jit-compilation.html (tracing with abstract values; caching and retracing)"
touches:
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#stack-pieces
tags: [jax, ecosystem]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**Concept.** The vertical stack is model code → JAX → StableHLO → XLA → device. JAX provides the numerics and the transformations (`jit`, `grad`, `vmap`). Flax (the module system; **NNX** is the recommended API for new code, **Linen** the previous one that existing frameworks still use), Optax (composable optimisers), Orbax (checkpointing) and Grain (data loading) are libraries built on JAX, side by side; none of them is a compiler rung.

**Relationships.** Everything they produce still passes through [concept/jax-compile-path](../concepts/jax-compile-path.md).

**Canonical terms.** JAX, Flax NNX, Flax Linen, Optax, Orbax, Grain.
