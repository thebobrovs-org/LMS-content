---
id: claim/pab-agent-identity-stage
type: claim
status: proposed
title: "Principal Access Boundary policies can apply to agent identities, as a set per project trust domain"
scope: "Google Cloud IAM as documented on 2026-11-17. The principal-set row was confirmed from the page body by the PR #155 reviewer; no launch stage was found, so do not quiz a stage"
sources:
  - "Google Cloud, Principal Access Boundary policies, docs.cloud.google.com/iam/docs/principal-access-boundary-policies (retrieved 2026-11-17; Supported principal sets table, confirmed from the page body by the PR #155 reviewer: lists agent identities as \"All agent identities in the specified project's trust domain\"; no Preview label was seen)"
touches:
  - agentic-ai/agent-identity-and-access
tags: [agents, security, iam]
related: [concept/agent-identity]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/5.2-agent-identity-and-access.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** A Principal Access Boundary policy can be bound to the agent identities in a project's trust domain as a principal set, rather than to one agent at a time.

**Limits.** The author read the page through a fetch summary; the PR #155 reviewer then confirmed the principal-set row on the page itself. The topic plan records two open reports: that PAB for Agent Identity is Preview, and that one IAM table says PAB does not support individual agent identities. Both fit this claim (a set, not an individual); the launch stage is still unconfirmed. The lesson therefore teaches what a boundary does and states no principal-set mechanics or launch stage. Review every 90 days.
