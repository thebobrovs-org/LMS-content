---
id: claim/loss-scaling-for-fp16
type: claim
status: approved
title: "fp16 training needs loss scaling because small gradients underflow; bf16's range removes that need"
scope: "Mixed-precision training of neural networks"
sources:
  - "Micikevicius et al. (2018), Mixed Precision Training, ICLR 2018, §3.2 (loss scaling) and §4"
  - "Google Cloud, \"The bfloat16 numerical format\", cloud.google.com/tpu/docs/bfloat16 (format layout; MXU multiplies in bfloat16 and accumulates in float32)"
touches:
  - math-infra/precision-and-memory
  - objective:math-infra/precision-and-memory#float-range-vs-precision
tags: [precision, training]
related:
  - claim/bf16-keeps-fp32-exponent
  - claim/fp16-overflows-past-65504
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**Claim.** In fp16 training a large share of gradient values fall below fp16's smallest representable magnitudes and are flushed to zero; scaling the loss up before the backward pass, and the gradients back down before the update, keeps them in range. bf16 has fp32's exponent, so the same gradients stay representable without scaling.

**Limits.**
- The claim is about range. bf16's coarser precision is a separate cost, tolerated in practice because rounding errors on individual updates are unbiased and average out over training, while an overflow is not recoverable.
- "Does not need loss scaling" is the common practice reported for bf16, not a guarantee for every model; a model with unusually small gradients can still underflow.
