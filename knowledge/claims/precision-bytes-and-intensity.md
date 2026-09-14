---
id: claim/precision-bytes-and-intensity
type: claim
status: approved
title: "Precision, bytes and arithmetic intensity"
scope: "Roofline reasoning at one stated memory boundary (HBM, or another named level), for a kernel whose FLOPs are fixed"
sources:
  - "Williams, Waterman, Patterson (2008), Roofline: an insightful visual performance model for floating-point programs and multicore architectures, EECS-2008-134, §2–3"
touches: [math-infra/precision-and-memory]
reviewed: 2026-09-12
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#87"
review-by: 2027-09-12
---

**Claim.** Arithmetic intensity is FLOPs divided by the bytes moved across the stated boundary. If a precision change halves *all* of those bytes and the FLOPs are unchanged, intensity doubles and the roofline's memory-bound ceiling doubles with it.

**Limits.**
- The boundary must be named. Bytes that move elsewhere (a cache level, ICI, DCN) are a different intensity.
- Only the traffic that actually changes counts. Worked case: 100 GFLOPs, 10 GB of traffic, a 100 GB/s boundary and a 2,000 GFLOP/s compute ceiling give intensity 10 and a bound of 1,000 GFLOP/s. Halving all traffic gives 20 and 2,000. Halving only 2 GB of it gives 9 GB, about 11.1 FLOP/byte and about 1,111 GFLOP/s.
- The ceiling is an upper bound on throughput, not a prediction of end-to-end training speed; see [misconception/fewer-bytes-faster-training](../misconceptions/fewer-bytes-faster-training.md).
