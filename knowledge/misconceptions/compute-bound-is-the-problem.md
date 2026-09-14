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

**The correcting example.** Compute-bound is the matrix unit saturated: the hardware you paid for is fully used. Memory-bound is the unit idling while bytes arrive. Every lever in these lessons (narrower formats, fusion, aligned shapes) pushes a workload up toward the compute ceiling, never down.
