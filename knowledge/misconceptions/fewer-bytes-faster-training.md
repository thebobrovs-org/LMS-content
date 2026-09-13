---
id: misconception/fewer-bytes-faster-training
type: misconception
status: approved
scope: "Learners meeting reduced-precision formats for the first time"
source: "Learning roadmap review, hyperstack docs/audits/2026-09-11, §9 (the worked pilot)"
touches: [math-infra/precision-and-memory]
reviewed: 2026-09-12
---

**The incorrect model.** "Half the bytes always means twice the training speed."

**How it shows.** A learner reads that a narrower format doubles arithmetic intensity, and predicts that a run in `bf16` finishes in half the time of the same run in `fp32`, whatever the kernel.

**Why it is wrong.** The doubling holds for the traffic that changes, at the boundary named, and it raises a *ceiling*. A kernel that was compute-bound gains nothing from the memory ceiling moving; a kernel whose traffic is mostly activations while only the weights changed format sees a smaller change (the worked case in [claim/precision-bytes-and-intensity](../claims/precision-bytes-and-intensity.md): halving 2 GB of 10 GB gives about 11% more intensity, not 100%).

**The correcting example.** Give the learner the same kernel twice: once memory-bound (intensity below the ridge point), once compute-bound (above it). Ask for a prediction before changing the format, then show that only the first case moves. The prediction-then-observation is the point; the numbers are secondary.
