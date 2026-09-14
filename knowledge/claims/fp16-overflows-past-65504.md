---
id: claim/fp16-overflows-past-65504
type: claim
status: approved
title: "fp16's largest finite value is 65,504; under round-to-nearest a magnitude of 65,520 or more overflows to infinity"
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

**Claim.** The largest finite binary16 value is (2 − 2⁻¹⁰) × 2¹⁵ = 65,504. Under round-to-nearest-even, a magnitude below 65,520 rounds to a finite value (65,510 becomes 65,504) and a magnitude of 65,520 or more rounds to ±infinity. bf16, with fp32's exponent, holds values up to about 3.4 × 10³⁸, so 70,000 fits in bf16 (rounded) and overflows fp16.

**Limits.** Other rounding modes (toward zero) saturate at 65,504 instead of producing infinity. The lesson's "past about 65,504" is the useful mental model; 65,520 is the exact threshold.
