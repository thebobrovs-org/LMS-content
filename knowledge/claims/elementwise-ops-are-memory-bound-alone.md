---
id: claim/elementwise-ops-are-memory-bound-alone
type: claim
status: approved
title: "An elementwise op on its own is memory-bound: about one operation per element read and written"
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

**Claim.** Bias, activation and scale operations do one cheap arithmetic operation per element but read and write every element: a few FLOPs per byte, far below any accelerator's ridge point. Alone they stall on HBM bandwidth; that is why fusing them into the matmul's epilogue is the optimisation that matters most in a transformer layer.

**Limits.** The exact FLOP-per-byte depends on the element width and the operation; the conclusion (below the ridge by a wide margin) holds for every common case.
