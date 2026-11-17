---
id: claim/model-armor-gateway-integration
type: claim
status: proposed
title: "Model Armor on Agent Gateway uses templates on ingress traffic and does not screen file uploads, as of November 2026"
scope: "The Model Armor integration with Agent Gateway as documented on 2026-11-17; parts were read through a fetch summary"
sources:
  - "Google Cloud, Model Armor integration with Agent Gateway, docs.cloud.google.com/model-armor/model-armor-agent-gateway-integration (retrieved 2026-11-17: Model Armor templates are specified on the gateway for ingress traffic; modes block and redact, or inspect and log; sanitizing prompts and responses that contain documents or file uploads such as PDFs is not supported; per a fetch summary, inline ingress screening is for ADK agents only and the template must be in the same region as the gateway)"
touches:
  - agentic-ai/guardrails-model-armor-hitl
  - agentic-ai/agent-gateway-and-registry
tags: [agents, security, guardrails]
related: [concept/layered-agent-guardrails, concept/agent-gateway]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/5.5-guardrails-model-armor-hitl.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** As of November 2026, Model Armor on Agent Gateway is configured with Model Armor templates (the plan's open question asked whether it is templates only; floor settings still bound what those templates may be), applied to ingress traffic, in block-and-redact or inspect-and-log mode. It does not sanitize prompts or responses that contain documents or file uploads such as PDFs.

**Limits.** The ADK-only and same-region details came from a fetch summary, so the lessons do not teach them. Whether egress tool calls are screened is not stated; the 5.4 and 5.5 lessons say only that the documentation describes templates for ingress. Review every 90 days.
