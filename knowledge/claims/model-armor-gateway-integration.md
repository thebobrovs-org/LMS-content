---
id: claim/model-armor-gateway-integration
type: claim
status: proposed
title: "Model Armor on Agent Gateway uses templates on ingress and egress traffic, with payload limits, as of November 2026"
scope: "The Model Armor integration with Agent Gateway as documented on 2026-11-17 (page last updated 2026-11-10); direction and limitation sentences quoted verbatim, payload lists paraphrased"
sources:
  - "Google Cloud, Model Armor integration with Agent Gateway, docs.cloud.google.com/model-armor/model-armor-agent-gateway-integration (last updated 2026-11-10, retrieved 2026-11-17: protects \"the incoming requests from the client to the agent\" and \"the outgoing requests from the agent to the external system\", with their responses; \"Inline ingress protection with Model Armor is only supported for agents built using ADK\"; egress inline protection \"is limited to integrations with MCP servers\", OpenAI-format services and A2A; \"Model Armor and the services it integrates with must be deployed within the same Google Cloud region\"; \"Sanitizing prompts and responses that contain documents or file uploads (such as PDFs) isn't supported in this integration\")"
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

**Claim.** As of November 2026, Model Armor on Agent Gateway is configured with Model Armor templates (the plan's open question asked whether it is templates only; floor settings still bound what those templates may be). It screens both directions: requests from the client to the agent and the agent's responses (ingress), and the agent's requests to external systems such as models, MCP servers and other agents, with their responses (egress). Limits: inline ingress protection only for ADK agents; inline egress protection only for MCP servers, OpenAI-format services and A2A; Model Armor and the gateway in the same region; no sanitizing of documents or file uploads such as PDFs, which go to the Model Armor API directly.

**Limits of this record.** The direction and limitation sentences were read verbatim through a fetch; the exact payload methods covered (for example MCP `tools/call`) were paraphrased and are not taught. The lessons teach both directions and the PDF limit only. Review every 90 days.
