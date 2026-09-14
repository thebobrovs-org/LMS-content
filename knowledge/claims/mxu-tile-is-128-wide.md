---
id: claim/mxu-tile-is-128-wide
type: claim
status: approved
title: "The TPU matrix unit is a 128×128 systolic array on v2 to v5p, 256×256 on v6e"
scope: "Cloud TPU generations v2 through v6e"
sources:
  - "Google Cloud, \"TPU system architecture\", cloud.google.com/tpu/docs/system-architecture-tpu-vm, section on the MXU"
  - "Google Cloud, \"TPU v6e\", cloud.google.com/tpu/docs/v6e (MXU size)"
touches:
  - math-infra/tensor-shapes
  - objective:math-infra/tensor-shapes#tile-padding
  - sim:matmul-tiler
tags: [mxu, tpu]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**Claim.** Each MXU on TPU v2, v3, v4, v5e and v5p is a 128 × 128 systolic array of multiply-accumulators; TPU v6e (Trillium) doubles the side to 256 × 256. A matmul is executed in tiles of that size, which is why 128 (or 256) is the multiple a dimension wants to align to.

**Limits.** Per generation: check the generation's documentation before assuming the tile. The lesson uses 128 throughout and says so.
