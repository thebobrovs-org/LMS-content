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

**The correcting example.** The device allocates the padded shape. Ask first whether the batch and feature dimensions are multiples of 8 and 128; a 129-wide dimension is allocated as 256. Align the dimension and the same job fits.
