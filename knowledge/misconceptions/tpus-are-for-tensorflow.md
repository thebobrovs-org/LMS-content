---
id: misconception/tpus-are-for-tensorflow
type: misconception
status: approved
title: "TPUs are a TensorFlow thing"
scope: "Infrastructure engineers meeting TPUs through older material"
sources:
  - "Google Cloud, \"Run a calculation on a TPU VM with JAX\", cloud.google.com/tpu/docs/run-calculation-jax"
touches:
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#stack-pieces
tags: [jax, tpu]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**The model.** "TPUs run TensorFlow; JAX is a research toy."

**How it shows.** A learner assumes the stack starts at TensorFlow, or looks for a TensorFlow runtime on a TPU VM.

**The correcting example.** Google's own TPU VM quickstart runs a calculation with JAX; the path is Python → JAX → StableHLO → XLA → TPU, and the model libraries (Flax NNX, Linen) sit on JAX. TensorFlow also targets XLA, but nothing in the stack requires it.
