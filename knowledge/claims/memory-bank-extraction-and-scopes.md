---
id: claim/memory-bank-extraction-and-scopes
type: claim
status: proposed
title: "Memory Bank extracts and consolidates memories with an LLM, isolated per scope, and retrieves all or the most relevant"
scope: "Agent Platform Memory Bank as documented on 2026-11-12/17, used from ADK through VertexAiMemoryBankService. Launch stage not stated on the pages read"
sources:
  - "Google Cloud, \"Agent Platform Memory Bank\", docs.cloud.google.com/gemini-enterprise-agent-platform/scale/memory-bank (last updated 2026-11-12, retrieved 2026-11-17; extracts only the most meaningful information and consolidates it with existing memories; generation at an interval such as the end of every session or turn; agents can write memories directly; an isolated collection per scope such as agent name and user; all sessions must have a user ID; simple retrieval of all memories or only the most relevant; custom topics and few-shot examples; memory TTL)"
  - "ADK documentation, \"Memory\", section \"Memory Bank\", github.com/google/adk-docs/blob/main/docs/sessions/memory.md (retrieved 2026-11-17; VertexAiMemoryBankService; requires an Agent Runtime instance, the agent need not be deployed there; --memory_service_uri agentengine://ID; add_memory direct creation or consolidation)"
touches:
  - agentic-ai/sessions-state-memory
  - objective:agentic-ai/sessions-state-memory#memory-bank
  - item:agentic-ai/sessions-state-memory#memory-wiring
  - item:agentic-ai/sessions-state-memory#preload-vs-load
  - item:agentic-ai/sessions-state-memory#memory-retention
  - item:agentic-ai/sessions-state-memory#preload-or-load
tags: [agents, memory, agent-platform]
terms: [Memory Bank, VertexAiMemoryBankService, memory scope, memory consolidation, memory TTL]
related: [concept/session-vs-memory]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.3-sessions-state-memory.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** Agent Platform Memory Bank generates memories from session data with an LLM, keeping only the meaningful information and consolidating it with existing memories; generation runs when you send it data (for example at the end of each session or turn), and an agent can also write a memory directly. Memories are kept in an isolated collection per scope (for example agent name and user), so every session needs a user id. Retrieval returns all memories for a scope or only the most relevant ones. Extraction can be steered with custom topics and few-shot examples, and memories can carry a time to live.

**Limits.** The plan's open question on Memory Bank's managed topic names is not settled here: the pages read name custom topics only, so lessons do not quote managed topic names. The launch stage was not stated on the pages read. In ADK it requires an Agent Runtime instance (the agent itself may run elsewhere).
