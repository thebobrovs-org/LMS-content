---
id: misconception/compute-bound-is-the-problem
type: misconception
status: approved
title: "Being compute-bound is a problem to fix"
scope: "Learners reading a roofline for the first time"
sources:
  - "Williams, Waterman, Patterson (2008), Roofline: an insightful visual performance model for floating-point programs and multicore architectures, EECS-2008-134, §2–3"
touches:
  - math-infra/precision-and-memory
  - objective:math-infra/precision-and-memory#roofline-placement
tags: [roofline]
related:
  - concept/arithmetic-intensity-and-the-ridge
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**The model.** "Compute-bound means the chip is overloaded; the goal is to reduce the load."

**How it shows.** A learner reads a workload above the ridge as a warning, or tries to move it down.

**The correcting example.** On the roofline, memory-bound and compute-bound name which resource **caps** attainable throughput at that intensity; neither is a fault. A kernel on the compute-limited side is bounded by the compute ceiling, but that is a ceiling: it does not show the kernel reaches it, runs on the matrix unit, or does useful work efficiently. The objective is useful throughput and runtime. Levers that move fewer bytes for the same work (narrower formats, fusion) push toward the compute ceiling; levers that remove wasted work (aligned shapes, fewer padded FLOPs) can shorten runtime even when the reported intensity or FLOP/s falls.
