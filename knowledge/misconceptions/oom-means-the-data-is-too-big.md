---
id: misconception/oom-means-the-data-is-too-big
type: misconception
status: approved
title: "A surprise OOM means the data is simply too big for the device"
scope: "Engineers sizing a job by element count"
sources:
  - "Google Cloud, \"Cloud TPU performance guide\", cloud.google.com/tpu/docs/performance-guide, section \"Padding\""
touches:
  - math-infra/tensor-shapes
  - objective:math-infra/tensor-shapes#surprise-oom
tags: [padding, memory]
related:
  - claim/padding-inflates-bytes-and-flops
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**The model.** "I computed the bytes from the element count and it fits, so an OOM must be a leak or a bug."

**How it shows.** A job that "should fit" dies at allocation time; the learner looks for a leak instead of at the shapes.

**The correcting example.** The device allocates buffers as the compiler lays them out, and a layout can be larger than the element count suggests. Whether a 129-wide feature dimension is *stored* as 256 depends on the layout XLA chooses for that tensor and operation; the lesson's simulation assumes it is, so the effect is visible ([claim/padding-to-tile-multiples](../claims/padding-to-tile-multiples.md)). The reliable move is to read what was actually allocated: the compiled executable's memory analysis reports argument, output and temporary sizes before anything runs ([claim/aot-compile-exposes-memory-analysis](../claims/aot-compile-exposes-memory-analysis.md)). Then ask whether the batch and feature dimensions are multiples of 8 and 128. A change that lowers a padded allocation must reduce the padded width, for instance trimming a 129-feature vector to 128 (a real change to the model) or a batch of 129 to 128; raising 129 to 256 keeps the same padded width and saves nothing. Padding is one contributor: the whole live requirement (parameters, optimiser state, activations, other executables) must still fit.
