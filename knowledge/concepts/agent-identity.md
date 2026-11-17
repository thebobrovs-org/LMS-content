---
id: concept/agent-identity
type: concept
status: proposed
title: "Per-agent identity, narrow roles and a Principal Access Boundary contain a hijacked agent"
scope: "Agents on Google Cloud using Agent Identity and IAM, as documented on 2026-11-17; the three-step framing (own identity, narrow grants, boundary) is this path's teaching frame"
sources:
  - "Google Cloud, Agent Identity overview, docs.cloud.google.com/iam/docs/agent-identity-overview (retrieved 2026-11-17: SPIFFE-based cryptographic identity per agent; X.509 certificates managed on the agent; tokens bound to them; not shared by default, cannot be impersonated, no long-lived keys; audit logs record the agent and the delegating user; grants made directly to the agent's identifier; supported by Agent Runtime, Gemini Enterprise, Cloud Run and GKE)"
  - "Google Cloud, Principal Access Boundary policies, docs.cloud.google.com/iam/docs/principal-access-boundary-policies (retrieved 2026-11-17: PAB defines the resources principals are eligible to access; it can only block, never grant; access is limited regardless of roles granted; only supported permissions are blocked)"
touches:
  - agentic-ai/agent-identity-and-access
tags: [agents, security, iam]
terms: [agent identity, spiffe, principal access boundary]
related: [concept/agent-threat-model, claim/pab-agent-identity-stage]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/5.2-agent-identity-and-access.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**Concept.** Design an agent's access as if prompt injection will succeed. Three steps shrink what a hijacked agent can reach. **Own identity:** with Agent Identity each agent is its own principal, so grants reach only that agent and audit logs name it and, when it acts for a user, that user; agent identities are not shared by default, cannot be impersonated, allow no long-lived keys, and their tokens are bound to the agent's certificate to prevent token theft. **Narrow grants:** grant the narrowest role on the narrowest resource each tool needs, never broad basic roles on a project. **A boundary:** a Principal Access Boundary policy sets the resources the principals it covers are eligible to access (for supported permissions), so a later broad grant still cannot reach past it.

**Roles grant; a boundary caps.** A PAB policy can only block or not block; access needs an allow-policy grant as well. With no PAB policy, a principal is eligible to access any resource.
