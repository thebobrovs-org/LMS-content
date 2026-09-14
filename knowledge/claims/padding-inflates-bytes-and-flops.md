---
id: claim/padding-inflates-bytes-and-flops
type: claim
status: approved
title: "Under square tile padding, a 129×129 matrix is executed as 256×256: four times the slots, a quarter useful"
scope: "Padding arithmetic on a square tile grid"
sources:
  - "Derived: 129² = 16,641 real values in a 256 × 256 = 65,536-slot tiled matrix; see claim/padding-to-tile-multiples for the rule"
touches:
  - math-infra/tensor-shapes
  - objective:math-infra/tensor-shapes#padding-waste
  - item:math-infra/tensor-shapes#predict-129-slots
  - sim:arithmetic-intensity-calculator
tags: [padding, roofline]
related:
  - claim/padding-to-tile-multiples
  - concept/arithmetic-intensity-and-the-ridge
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**Claim.** Under the simulation's model (both operands padded to 128-wide tiles on every axis), a 129 × 129 matrix is executed as 256 × 256: 65,536 slots for 16,641 real values, about 25% useful. Two costs follow: the **executed FLOPs** grow with the padded dimensions (cubically for a square matmul padded on every axis), and the **bytes moved** grow with the padded operands (quadratically). The useful work per executed FLOP and per byte falls.

**Two intensities.** *Executed* intensity (executed FLOPs ÷ bytes moved) is what the roofline places on its axes and can even rise under padding, since executed FLOPs grow faster than bytes. *Useful* intensity (useful FLOPs ÷ bytes moved) falls. Padding is therefore a loss of useful-work efficiency; whether the padded operation ends up memory-bound or compute-bound needs the padded compute time and the padded transfer time compared, not the useful-FLOP intensity alone. Wasted computation can be the dominant cost.

**Limits.** "Nearly doubles" is per padded axis; the square model is the simulation's assumption ([claim/padding-to-tile-multiples](../claims/padding-to-tile-multiples.md)); the buffer XLA allocates may differ from the executed tiling.
