---
id: claim/fp4-e2m1-values
type: claim
status: approved
title: "OCP FP4 E2M1 represents only eight magnitudes, at most 6, so values are scaled into range"
scope: "The OCP Microscaling FP4 element format"
sources:
  - "Open Compute Project, OCP Microscaling Formats (MX) Specification v1.0 (September 2023), §5.3 (element data types: FP4 E2M1)"
touches:
  - math-infra/precision-and-memory
  - objective:math-infra/precision-and-memory#float-range-vs-precision
  - sim:number-format-explorer
tags: [precision, fp4]
provenance:
  origin: authoring
  by: agent:claude
  model: claude-fable-5-1
  from: "LMS-content#105"
reviewed: 2026-09-13
review-by: 2026-12-12
---

**Claim.** The MX FP4 element type E2M1 has 1 sign, 2 exponent and 1 mantissa bit. Its representable magnitudes are 0, 0.5, 1, 1.5, 2, 3, 4 and 6; there are no infinities or NaNs. On its own it rounds or saturates almost any real activation, so the format is used with a shared per-block scale (the "microscaling" in MX) that brings a block of values into that range first.

**Limits.** This is the OCP MX definition. A vendor's "fp4" may differ in layout, scaling block size or special values; check the accelerator's documentation before assuming E2M1.
