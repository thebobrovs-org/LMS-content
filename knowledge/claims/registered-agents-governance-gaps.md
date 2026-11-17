---
id: claim/registered-agents-governance-gaps
type: claim
status: proposed
title: "Agents registered in Gemini Enterprise don't inherit all console governance: console Model Armor settings skip ADK and A2A agents, A2A traffic bypasses Agent Gateway"
scope: "Gemini Enterprise registration of ADK agents hosted on Agent Runtime (launch stage not stated; REST examples use v1alpha) and of A2A agents (preview), as documented on 2026-11-17"
sources:
  - "Google Cloud, Gemini Enterprise, \"Register and manage ADK agents hosted on Agent Runtime\", docs.cloud.google.com/gemini/enterprise/docs/register-and-manage-an-adk-agent (retrieved 2026-11-17; Model Armor settings in the console don't automatically protect ADK agents; configure it through the REST API in the agent's code)"
  - "Google Cloud, Gemini Enterprise, \"Register and manage A2A agents\", docs.cloud.google.com/gemini/enterprise/docs/register-and-manage-an-a2a-agent (retrieved 2026-11-17; preview; traffic to a registered A2A agent bypasses Agent Gateway; the apiKey security scheme isn't supported; console Model Armor settings don't automatically protect A2A agents)"
touches:
  - agentic-ai/low-code-or-code
  - objective:agentic-ai/low-code-or-code#migration-risks
  - item:agentic-ai/low-code-or-code#what-migrations-break
  - item:agentic-ai/low-code-or-code#model-armor-registered-adk
tags: [agents, governance, security]
terms: [Model Armor, Agent Gateway, A2A, custom agent via Agent Runtime]
related: [concept/low-code-vs-code-agents]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/0.4-low-code-or-code.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** When an ADK agent deployed to Agent Runtime is registered in Gemini Enterprise, the Model Armor settings configured in the Gemini Enterprise console don't automatically protect it; the agent configures screening itself, through the Model Armor REST API in its code. The same holds for a registered A2A agent. When an A2A agent is registered (preview), its traffic bypasses Agent Gateway, and the A2A apiKey security scheme isn't supported.

**Limits.** Both are documented behaviours of registration as of the retrieval date and may change, especially the A2A path while it is in preview. They don't mean Model Armor can't protect ADK agents, or that A2A agents can't be governed: the protection has to be placed with the agent rather than assumed from the console.
