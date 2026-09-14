---
id: claim/mxu-multiplies-bf16-accumulates-fp32
type: claim
status: approved
title: "The TPU matrix unit multiplies bf16 inputs and accumulates in fp32, which reduces, not removes, rounding error"
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

**Claim.** On the documented bf16 path, the MXU takes bfloat16 inputs, multiplies them, and accumulates the partial sums in float32. The bandwidth saving comes from the 2-byte inputs; the running sum of a long dot product is kept at fp32 precision, so it rounds far less than a bf16 accumulator would.

**Limits.**
- fp32 has finite precision too: adding 1 to 2²⁴ under round-to-nearest loses the increment, so long reductions and cancellation still carry rounding error, and the result depends on reduction order. fp32 accumulation reduces the error relative to bf16 accumulation; it does not make the reduction exact.
- Which input formats a generation accepts (int8, fp8, fp4 on newer chips) and how it accumulates them is per generation; the bf16-in, fp32-accumulate statement is the documented one.
