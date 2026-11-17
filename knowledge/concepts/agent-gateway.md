---
id: concept/agent-gateway
type: concept
status: proposed
title: "Identity names the caller, the registry names the target, and the gateway applies policy between them"
scope: "Runtime governance of agents on Google Cloud with Agent Identity, Agent Registry and Agent Gateway, as documented on 2026-11-17; the three-question framing is this path's teaching frame"
sources:
  - "Google Cloud, Agent Registry identity and identifiers, docs.cloud.google.com/agent-registry/identity-and-identifiers (last updated 2026-11-10, retrieved 2026-11-17: identifiers and identities for registered agents, MCP servers, endpoints and skills, to discover capabilities, enforce access policies and route runtime traffic; URNs for discovery, which cannot be used in IAM policy bindings, authorization headers or Agent Gateway route rules; resource names for policies; a managed SPIFFE-format workload identity, provisioned by Google Cloud, for agents running on it)"
  - "Google Cloud, Agent Gateway overview, docs.cloud.google.com/gemini-enterprise-agent-platform/govern/gateways/agent-gateway-overview (retrieved 2026-11-17: centralise access policies, mTLS and MCP security; Model Armor configurable on a gateway; traces and access logs; the body was read partly through a fetch summary)"
touches:
  - agentic-ai/agent-gateway-and-registry
tags: [agents, security, governance]
terms: [agent gateway, agent registry]
related: [concept/agent-identity, concept/agent-threat-model, claim/agent-gateway-supported-runtimes]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/5.4-agent-gateway-and-registry.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**Concept.** With many agents calling many tools, governance needs three answers. **Agent identity**: who is calling (each agent's own principal). **Agent Registry**: what exists and is approved (a catalogue of agents, MCP servers, endpoints and skills, each with identifiers). **Agent Gateway**: whether this call may happen now, and what happened (a point on agent traffic that enforces access policies, can screen content with Model Armor, and records the traffic for monitoring).

**Identifiers.** Registry URNs (`urn:agent:…`, `urn:mcp:…`) identify entries across the registry but cannot be used in policies; policy bindings and gateway route rules use resource names (`projects/…/locations/…/agents/…`).

**Design order.** Give every agent its own identity, register what you approve, then route agent traffic through the gateway with policies naming the caller's identity and the target's resource name, so that, when all of an agent's outbound traffic passes through the gateway, a call to an unregistered server fails and is recorded.
