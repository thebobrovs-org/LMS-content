---
id: concept/arithmetic-intensity-and-the-ridge
type: concept
status: approved
title: "Arithmetic intensity and the roofline's ridge"
scope: "Roofline reasoning for a kernel at one memory boundary"
sources:
  - "Williams, Waterman, Patterson (2008), Roofline: an insightful visual performance model for floating-point programs and multicore architectures, EECS-2008-134, §2–3"
  - "Austin et al., \"How to Scale Your Model\" (jax-ml.github.io/scaling-book), Part 1: Rooflines"
touches:
  - math-infra/precision-and-memory
  - objective:math-infra/precision-and-memory#bytes-to-intensity
  - objective:math-infra/precision-and-memory#roofline-placement
  - sim:arithmetic-intensity-calculator
  - checkpoint:arithmetic-intensity-calculator/observe-roofline
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#fusion-hbm-trips
tags: [roofline, performance]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**Concept.** Arithmetic intensity is FLOPs performed per byte moved across a stated boundary (HBM, for a TPU kernel). The roofline draws two ceilings: bandwidth × intensity (memory-bound) and the peak compute rate (compute-bound). They cross at the **ridge point**, intensity = peak FLOP/s ÷ bandwidth. Below the ridge the unit waits on bytes; above it the unit is the limit.

**Relationships.** Anything that moves fewer bytes for the same FLOPs raises intensity: narrower number formats ([claim/precision-bytes-and-intensity](../claims/precision-bytes-and-intensity.md)), fusion that keeps intermediates on-chip ([claim/xla-fusion-keeps-intermediates-on-chip](../claims/xla-fusion-keeps-intermediates-on-chip.md)). Padding moves more bytes and lowers it ([claim/padding-inflates-bytes-and-flops](../claims/padding-inflates-bytes-and-flops.md)).

**Worked example.** A chip with 2,000 GFLOP/s and a 100 GB/s boundary has its ridge at 20 FLOP/byte. A kernel at 10 FLOP/byte is capped at 1,000 GFLOP/s; halving its bytes puts it at the ridge.

**Canonical terms.** arithmetic intensity, roofline, ridge point, memory-bound, compute-bound.
