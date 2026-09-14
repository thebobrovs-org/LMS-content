---
id: misconception/all-16-bit-floats-have-the-same-reach
type: misconception
status: approved
title: "All 16-bit floats can hold the same values"
scope: "Learners meeting bf16 and fp16 together"
sources:
  - "Google Cloud, \"The bfloat16 numerical format\", cloud.google.com/tpu/docs/bfloat16 (format layout; MXU multiplies in bfloat16 and accumulates in float32)"
  - "IEEE Std 754-2019, §3.4 (binary interchange format encodings) and Table 3.5 (binary16, binary32 parameters)"
touches:
  - math-infra/precision-and-memory
  - objective:math-infra/precision-and-memory#overflow-prediction
  - item:math-infra/precision-and-memory#predict-70000
tags: [precision]
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

**The model.** "bf16 and fp16 are both half-precision, so they hold the same numbers; the difference is a detail."

**How it shows.** A learner predicts that a 70,000 activation is fine in both formats, or that a value fp16 overflows on must overflow in bf16 too.

**The correcting example.** Push a value past 65,504 in the number-format explorer: fp16 becomes infinity, bf16 keeps a rounded value, because bf16 spends 8 bits on the exponent and fp16 only 5. Same byte width, opposite bets.
