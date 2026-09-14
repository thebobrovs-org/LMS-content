---
id: claim/bf16-keeps-fp32-exponent
type: claim
status: approved
title: "bf16 keeps fp32's 8-bit exponent and drops significand bits; fp16 does the opposite"
scope: "The bfloat16 and IEEE binary16 formats"
sources:
  - "Google Cloud, \"The bfloat16 numerical format\", cloud.google.com/tpu/docs/bfloat16 (format layout; MXU multiplies in bfloat16 and accumulates in float32)"
  - "IEEE Std 754-2019, §3.4 (binary interchange format encodings) and Table 3.5 (binary16, binary32 parameters)"
touches:
  - math-infra/precision-and-memory
  - objective:math-infra/precision-and-memory#float-range-vs-precision
tags: [precision, bf16, fp16]
related:
  - concept/float-range-and-precision
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**Claim.** bfloat16 is 1 sign bit, 8 exponent bits and 7 significand bits: the same exponent width, and so the same dynamic range, as fp32 (binary32), in half the bytes. IEEE binary16 (fp16) is 1 sign bit, 5 exponent bits and 10 significand bits: more precision than bf16, far less range.

**Limits.**
- "Same range as fp32" is about the exponent; bf16 values are rounded far more coarsely than fp32 values (7 versus 23 significand bits).
- bf16 is not an IEEE 754 interchange format; its arithmetic behaviour on a given accelerator (rounding mode, subnormal handling) is the vendor's documentation, not the standard's.
