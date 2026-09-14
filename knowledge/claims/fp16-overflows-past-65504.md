---
id: claim/fp16-overflows-past-65504
type: claim
status: approved
title: "fp16's largest finite value is 65,504; a larger magnitude overflows to infinity"
scope: "IEEE binary16 under round-to-nearest"
sources:
  - "IEEE Std 754-2019, §3.4 (binary interchange format encodings) and Table 3.5 (binary16, binary32 parameters)"
touches:
  - math-infra/precision-and-memory
  - objective:math-infra/precision-and-memory#overflow-prediction
  - item:math-infra/precision-and-memory#predict-70000
  - sim:number-format-explorer
  - checkpoint:number-format-explorer/observe-overflow
tags: [precision, fp16, overflow]
related:
  - claim/bf16-keeps-fp32-exponent
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**Claim.** The largest finite binary16 value is (2 − 2⁻¹⁰) × 2¹⁵ = 65,504. Under round-to-nearest, a result whose magnitude rounds beyond that becomes ±infinity. bf16, with fp32's exponent, holds values up to about 3.4 × 10³⁸, so 70,000 fits in bf16 (rounded) and overflows fp16.

**Limits.**
- The exact threshold under round-to-nearest-even is 65,520: values between 65,504 and 65,520 round down to 65,504, values at or above 65,520 round to infinity. The lesson's "past about 65,504" is the useful mental model.
- Other rounding modes (toward zero) saturate at 65,504 instead of producing infinity.
