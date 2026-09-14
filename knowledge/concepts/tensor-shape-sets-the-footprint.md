---
id: concept/tensor-shape-sets-the-footprint
type: concept
status: approved
title: "A tensor's shape, not a vague size, sets what is allocated"
scope: "Dense tensors on accelerators"
sources:
  - "NumPy reference, numpy.ndarray.nbytes (bytes consumed = size × itemsize)"
  - "Google Cloud, \"Cloud TPU performance guide\", cloud.google.com/tpu/docs/performance-guide, section \"Padding\""
touches:
  - math-infra/tensor-shapes
  - objective:math-infra/tensor-shapes#tensor-shape-footprint
tags: [tensors, memory]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2027-09-13
---

**Concept.** A tensor's shape is the size of each of its dimensions. The bytes a dense tensor occupies are the product of its dimensions times the bytes per element; on an accelerator the allocated buffer is the shape **after** the compiler's layout and padding, which can be larger than the element count suggests.

**Relationships.** The tile rule that inflates a shape is [claim/padding-to-tile-multiples](../claims/padding-to-tile-multiples.md); the bill it produces is [claim/padding-inflates-bytes-and-flops](../claims/padding-inflates-bytes-and-flops.md).

**Worked example.** A 1,000 × 129 fp32 tensor holds 129,000 elements (516,000 bytes) but, padded to 128-wide tiles, is laid out as 1,000 × 256 (1,024,000 bytes).

**Canonical terms.** shape, dimension, element count, footprint, layout.
