---
id: claim/mxu-multiplies-bf16-accumulates-fp32
type: claim
status: approved
title: "The TPU matrix unit multiplies bf16 inputs and accumulates in fp32"
scope: "Cloud TPU matrix units"
sources:
  - "Google Cloud, \"The bfloat16 numerical format\", cloud.google.com/tpu/docs/bfloat16 (format layout; MXU multiplies in bfloat16 and accumulates in float32)"
touches:
  - math-infra/precision-and-memory
  - objective:math-infra/precision-and-memory#bytes-to-intensity
tags: [precision, mxu]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**Claim.** The MXU takes bfloat16 inputs, multiplies them, and accumulates the partial sums in float32. The bandwidth saving comes from the 2-byte inputs; the running sum of a long dot product is kept at fp32 precision, so rounding does not pile up across the reduction.

**Limits.** Which input formats a given generation accepts (int8, fp8, fp4 on newer chips) is per generation; the fp32 accumulation is the constant.
