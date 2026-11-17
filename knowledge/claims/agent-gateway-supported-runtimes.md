---
id: claim/agent-gateway-supported-runtimes
type: claim
status: proposed
title: "Agent Gateway runtime support and policy availability, as of November 2026"
scope: "Google Cloud Agent Gateway as documented on 2026-11-17. Read through a fetch summary of the overview page, not verbatim text; a reviewer must confirm before any of it is taught or quizzed"
sources:
  - "Google Cloud, Agent Gateway overview, docs.cloud.google.com/gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview (last updated 2026-11-16 per a fetch summary, retrieved 2026-11-17: available for agents on Gemini Enterprise Agent Platform and GKE; Limited Preview for agents on Cloud Run and on Kubernetes clusters outside Google Cloud; support for token management policies and extension bindings is coming soon; policy types include IAM unified access policies linking an agent's identity to approved tools and endpoints in Agent Registry)"
touches:
  - agentic-ai/agent-gateway-and-registry
tags: [agents, security, governance]
related: [concept/agent-gateway]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/5.4-agent-gateway-and-registry.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** As of November 2026, Agent Gateway is available for agents on Gemini Enterprise Agent Platform and GKE, and in Limited Preview for agents on Cloud Run and on Kubernetes outside Google Cloud. Token management policies and extension bindings are listed as coming soon.

**Limits.** This came from a fetch summary of the page's later sections, not verbatim text, and the plan lists these as open questions from exam preparation. The lesson states no runtime or launch stage for this reason. Review every 90 days.
