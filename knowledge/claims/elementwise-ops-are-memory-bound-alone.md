---
id: claim/elementwise-ops-are-memory-bound-alone
type: claim
status: approved
title: "A large, simple elementwise kernel on its own is memory-bound at the HBM boundary"
scope: "Elementwise operations on accelerators"
sources:
  - "Austin et al., \"How to Scale Your Model\" (jax-ml.github.io/scaling-book), Part 1: Rooflines"
  - "Williams, Waterman, Patterson (2008), Roofline: an insightful visual performance model for floating-point programs and multicore architectures, EECS-2008-134, §2–3"
touches:
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#fusion-hbm-trips
tags: [roofline, fusion]
related:
  - claim/xla-fusion-keeps-intermediates-on-chip
  - concept/arithmetic-intensity-and-the-ridge
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**Claim.** A simple streaming elementwise kernel over a large tensor (a bias add, a scale) does a few operations per element but reads and writes every element: a few FLOPs per byte at the HBM boundary, far below the ridge point of a matrix unit. Run alone, such a kernel is bounded by HBM bandwidth, which is why XLA fuses it into the producing matmul's epilogue where it can.

**Limits.**
- Scope: large tensors and simple operations at the stated boundary. An activation with transcendental functions does more work per element; a small array can be bounded by launch and dispatch overhead instead; and the applicable compute ceiling is that of the unit the operation runs on (the vector unit, not the MXU).
- Fusing these kernels helps in proportion to the time they and their transfers take in the whole step. A layer whose time is dominated by its matmuls gains little; the lesson's race shows the chain's own time, not the layer's.
