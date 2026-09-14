---
id: claim/loss-scaling-for-fp16
type: claim
status: approved
title: "fp16 training commonly needs loss scaling because small gradients underflow; bf16's range removes that particular need"
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
- The claim is about **range**. Precision is a separate matter: with deterministic round-to-nearest, small updates to a low-precision weight can round away every time (subtracting 0.001 from a bf16 weight of 1 returns 1), which is why mixed-precision recipes keep an fp32 master copy of the weights or the optimiser state and apply updates there. "Rounding averages out" holds for unbiased (stochastic) rounding, not for ordinary rounding.
- An overflow is not fatal by itself: dynamic loss scaling detects a non-finite gradient, skips that update and lowers the scale.
- "Needs loss scaling" is the common practice reported for fp16, not a law; a model whose gradients stay in range does without it, and a bf16 model with unusually small gradients can still underflow.
