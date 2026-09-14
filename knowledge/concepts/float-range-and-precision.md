---
id: concept/float-range-and-precision
type: concept
status: approved
title: "A float is range plus precision"
scope: "Binary floating-point formats as taught to infrastructure engineers"
sources:
  - "IEEE Std 754-2019, §3.4 (binary interchange format encodings) and Table 3.5 (binary16, binary32 parameters)"
touches:
  - math-infra/precision-and-memory
  - objective:math-infra/precision-and-memory#float-range-vs-precision
tags: [precision, floating-point]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**Concept.** A binary floating-point number spends its bits on a sign, an exponent and a significand (the mantissa). The exponent's width sets the **dynamic range**: how large and how small a value can be before it overflows to infinity or underflows toward zero. The significand's width sets the **precision**: how finely nearby values can be told apart.

**Relationships.** Two formats of the same byte width can make opposite bets, see [claim/bf16-keeps-fp32-exponent](../claims/bf16-keeps-fp32-exponent.md). Range decides whether a value is representable at all; precision decides how much it is rounded, see [claim/loss-scaling-for-fp16](../claims/loss-scaling-for-fp16.md).

**Worked example.** binary32 (fp32) has 8 exponent bits and 23 significand bits; binary16 (fp16) has 5 and 10. The same bit budget could instead keep 8 exponent bits and drop to 7 significand bits, which is what bfloat16 does.

**Canonical terms.** exponent, significand (mantissa), dynamic range, precision, overflow, underflow.
