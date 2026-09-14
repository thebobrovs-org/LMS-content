---
id: claim/xla-fusion-keeps-intermediates-on-chip
type: claim
status: approved
title: "XLA fusion merges a chain of elementwise ops into one kernel so intermediates never round-trip through HBM"
scope: "XLA on TPU and GPU"
sources:
  - "OpenXLA, \"XLA architecture\", openxla.org/xla/architecture (fusion of elementwise operations)"
touches:
  - ml-systems/jax-xla-stack
  - objective:ml-systems/jax-xla-stack#fusion-hbm-trips
  - item:ml-systems/jax-xla-stack#predict-fusion
  - sim:xla-fusion-explorer
  - checkpoint:xla-fusion-explorer/observe-fusion
tags: [xla, fusion, roofline]
related:
  - concept/arithmetic-intensity-and-the-ridge
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**Claim.** Unfused, each elementwise operation after a matmul reads its whole input from HBM and writes its whole output back. XLA fuses such chains into the producing kernel: the inputs are read once, the elementwise work runs on the values while they are on-chip, and only the final result is written. The FLOPs are unchanged; the bytes moved fall, so arithmetic intensity rises.

**Limits.** Which operations XLA can fuse, and how far, depends on the backend and the graph; a fusion decision is visible in the compiled HLO, not guaranteed by the source.
