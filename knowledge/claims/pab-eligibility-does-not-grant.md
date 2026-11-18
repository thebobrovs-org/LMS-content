---
id: claim/pab-eligibility-does-not-grant
type: claim
status: proposed
title: Principal Access Boundaries cap eligible resources but never grant access
scope: "One Google Cloud principal, covered object-read permissions, and explicitly stated allow-policy grants"
sources:
  - "https://docs.cloud.google.com/iam/docs/principal-access-boundary-policies (retrieved 2026-11-17; policy evaluation and multiple-policy union)"
  - "https://docs.cloud.google.com/iam/docs/policy-types (retrieved 2026-11-17; allow policies versus PABs)"
  - "https://docs.cloud.google.com/iam/docs/resource-hierarchy-access-control (retrieved 2026-11-17; inherited grants)"
  - "https://docs.cloud.google.com/storage/docs/access-control/iam-roles (retrieved 2026-11-17; roles/storage.objectViewer)"
  - "https://docs.cloud.google.com/storage/docs/reading-objects (retrieved 2026-11-17; storage.objects.get)"
  - "https://docs.cloud.google.com/iam/docs/pab-blocked-permissions (retrieved 2026-11-17; enforcement version 1, storage.googleapis.com/objects.get)"
touches:
  - agentic-ai/agent-identity-and-access
  - objective:agentic-ai/agent-identity-and-access#pab
  - sim:access-boundary-explorer
  - checkpoint:access-boundary-explorer/observe-boundary-caps
provenance:
  origin: authoring
  by: agent:codex
  from: "LMS-content#197"
reviewed: "2026-11-17"
review-by: "2027-02-15"
---

A Principal Access Boundary determines resource eligibility for supported
permissions; an allow-policy grant is still necessary. A broad grant can widen
access within the eligible resources. Multiple applicable PAB policies combine
eligibility by union, so a Finance-only policy does not override another policy
that makes HR eligible. No applicable PAB leaves resources eligible by default.

B07 illustrates this with four private buckets in three projects under one
organization, one existing object per bucket, uniform bucket-level access,
exactly one Finance PAB when enabled, and no other grants, public access, ACLs,
deny policies or conditional bindings. The selected role is Storage Object
Viewer at either the Invoices bucket or the organization. Only object reads
are tested: storage.objects.get is covered by PAB enforcement version 1.

The scripted outcomes are 1/4 readable with the bucket grant, 2/4 with the
organization grant and Finance PAB, 4/4 with that grant and no PAB, and 0/4
without grants. These are teaching fixtures, not live API results or a complete
IAM evaluator. IAM does not detect prompt injection. Technical-accuracy review
is pending; this record is proposed, not approved.
