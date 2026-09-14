---
id: claim/padding-inflates-bytes-and-flops
type: claim
status: approved
title: "A 129-wide dimension on 128-wide tiles becomes 256: four times the slots of a 129×129 matrix, three quarters zeros"
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

**Claim.** Padding costs twice. **Memory:** the zeros are stored in HBM, so a 129 × 129 matrix occupies 256 × 256 = 65,536 slots for 16,641 values, about 25% useful. **Compute:** the matrix unit multiplies the zeros, so the work on that axis nearly doubles. Because the bytes moved grow while the useful FLOPs do not, arithmetic intensity falls and the operation slides toward memory-bound.

**Limits.** "Nearly doubles" is per padded axis; when the reduction dimension pads too the wasted multiplies grow further. Sparse or non-tiled paths do not follow this arithmetic.
