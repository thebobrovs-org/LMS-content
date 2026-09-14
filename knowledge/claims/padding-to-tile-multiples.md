---
id: claim/padding-to-tile-multiples
type: claim
status: approved
title: "XLA pads a misaligned matmul dimension up to the next multiple of the tile"
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

**Claim.** When a dimension of a matmul operand is not a multiple of the MXU tile width, the compiler pads it with zeros up to the next multiple before the operation runs; the padded elements are stored and multiplied like real ones. The Cloud TPU performance guide states the alignment to aim for: the batch dimension a multiple of 8, the feature dimension a multiple of 128.

**Limits.** The exact padded layout is the compiler's choice and can differ by generation and by operation; the rule of thumb (multiples of 8 and 128) is the guide's, not a guarantee of the layout XLA picks.
