---
id: claim/padding-to-tile-multiples
type: claim
status: approved
title: "A misaligned matmul dimension is executed in whole tiles; the guide's alignment rule is multiples of 8 and 128"
scope: "Dense matmuls on Cloud TPU"
sources:
  - "Google Cloud, \"Cloud TPU performance guide\", cloud.google.com/tpu/docs/performance-guide, section \"Padding\""
touches:
  - math-infra/tensor-shapes
  - objective:math-infra/tensor-shapes#tile-padding
  - item:math-infra/tensor-shapes#predict-129-slots
  - sim:matmul-tiler
  - checkpoint:matmul-tiler/observe-padding
tags: [padding, xla]
related:
  - claim/mxu-tile-is-128-wide
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**Claim.** The matrix unit executes a matmul in fixed-size tiles, so a dimension that is not a multiple of the tile width is processed as if it were rounded up to the next multiple: the extra rows or columns are zeros the unit still multiplies. The Cloud TPU performance guide's rule for avoiding that waste is to make the batch dimension a multiple of 8 and the feature dimension a multiple of 128.

**Limits.**
- This is about **execution tiling**, not the physical buffer in HBM. How XLA lays a tensor out in memory (which dimensions are padded, and to what) is the compiler's choice per operation and generation; the execution rounding does not by itself say how many bytes a buffer occupies.
- The lesson's simulation assumes square 128 × 128 padding on both matmul operands so the effect is visible; that is the simulation's model, and the arithmetic in [claim/padding-inflates-bytes-and-flops](../claims/padding-inflates-bytes-and-flops.md) is stated under it.
- The 8-and-128 rule is the guide's recommendation for common layouts, not a description of every layout XLA picks.
