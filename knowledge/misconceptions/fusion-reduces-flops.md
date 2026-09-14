---
id: misconception/fusion-reduces-flops
type: misconception
status: approved
title: "Fusion makes a chain faster because it does less math"
scope: "Learners predicting what fusion changes"
sources:
  - "OpenXLA, \"XLA architecture\", openxla.org/xla/architecture (fusion of elementwise operations)"
touches:
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#fusion-hbm-trips
  - item:ml-systems/jax-xla-stack#predict-fusion
tags: [fusion, roofline]
related:
  - claim/xla-fusion-keeps-intermediates-on-chip
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**The model.** "The fused kernel finishes sooner, so it must be doing fewer operations."

**How it shows.** In the prediction before the fusion race, the learner picks "fewer FLOPs".

**The correcting example.** Count the FLOPs of the chain before and after fusion in the explorer: identical. What changed is the bytes through HBM. The chain moves toward the ridge because the same work is done over fewer bytes, not because there is less work.
