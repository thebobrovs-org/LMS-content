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

**Concept.** A tensor's shape is the size of each of its dimensions. The bytes a dense tensor holds are the product of its dimensions times the bytes per element; the buffer an accelerator **allocates** for it is the shape after the compiler's layout, which may add padding and so be larger than that product. Shape, not a vague "size", is what the allocation follows.

**Relationships.** How execution tiling rounds a dimension is [claim/padding-to-tile-multiples](../claims/padding-to-tile-multiples.md); whether that rounding is also stored is the layout's choice; the executed cost under the simulation's square model is [claim/padding-inflates-bytes-and-flops](../claims/padding-inflates-bytes-and-flops.md); the allocation as compiled can be read before running ([claim/aot-compile-exposes-memory-analysis](../claims/aot-compile-exposes-memory-analysis.md)).

**Worked example.** A 1,000 × 129 fp32 tensor holds 129,000 elements, 516,000 bytes. Under a layout that pads the 129-wide feature dimension to the 128-wide tile (the simulation's assumption; the batch dimension of 1,000 is already a multiple of 8), the buffer is 1,000 × 256 elements, 1,024,000 bytes. Under a layout that does not pad it, the buffer stays at 516,000 bytes; the memory analysis says which.

**Canonical terms.** shape, dimension, element count, footprint, layout, allocation.
