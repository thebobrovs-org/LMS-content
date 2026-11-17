---
id: claim/agent-platform-sessions-ttl
type: claim
status: proposed
title: "Agent Platform Sessions require every session to expire; the default time to live is 365 days"
scope: "Agent Platform Sessions used through ADK's VertexAiSessionService, as documented on 2026-11-12"
sources:
  - "Google Cloud, \"Manage sessions with ADK\", docs.cloud.google.com/gemini-enterprise-agent-platform/scale/sessions/manage-with-adk (last updated 2026-11-12, retrieved 2026-11-17; \"All sessions must have an expiration time\"; if neither a TTL nor an expire time is specified, a default TTL of 365 days applies; the Runner uses VertexAiSessionService to connect to Agent Platform Sessions)"
touches:
  - agentic-ai/sessions-state-memory
  - objective:agentic-ai/sessions-state-memory#session-vs-memory
  - item:agentic-ai/sessions-state-memory#inmemory-in-production
tags: [agents, sessions, agent-platform]
terms: [Agent Platform Sessions, VertexAiSessionService, session TTL]
related: [concept/session-vs-memory]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.3-sessions-state-memory.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** Agent Platform Sessions, the managed session store ADK reaches through `VertexAiSessionService`, requires every session to have an expiration; when neither a time to live nor an expire time is set, a default of 365 days applies, and expired sessions are deleted.

**Limits.** A vendor default that can change: re-check by the review date. Sessions hold one conversation's events and state; cross-session recall is Memory Bank's job.
