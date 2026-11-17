---
id: concept/session-vs-memory
type: concept
status: proposed
title: "Session, state and long-term memory: where an agent's data belongs"
scope: "ADK sessions, state and memory services as documented on 2026-11-17 (Python examples)"
sources:
  - "ADK documentation, \"State\", github.com/google/adk-docs/blob/main/docs/sessions/state.md (retrieved 2026-11-17; prefixes: none = current session, user: = all sessions of a user in the app, app: = all users and sessions, temp: = current invocation, never persisted; persistence depends on the SessionService)"
  - "ADK documentation, \"Session\", github.com/google/adk-docs/blob/main/docs/sessions/session/index.md (retrieved 2026-11-17; a session holds events and state; InMemorySessionService loses data on restart; VertexAiSessionService uses Agent Platform; DatabaseSessionService for a database you manage)"
  - "ADK documentation, \"Memory\", github.com/google/adk-docs/blob/main/docs/sessions/memory.md (retrieved 2026-11-17; session/state as short-term memory, MemoryService as long-term knowledge; add_session_to_memory, search_memory; preload_memory and load_memory tools; after-agent callback that saves the session to memory)"
touches:
  - agentic-ai/sessions-state-memory
  - objective:agentic-ai/sessions-state-memory#session-vs-memory
  - objective:agentic-ai/sessions-state-memory#state-scopes
  - item:agentic-ai/sessions-state-memory#session-state-memory
  - item:agentic-ai/sessions-state-memory#state-prefixes
  - item:agentic-ai/sessions-state-memory#preferred-language
  - item:agentic-ai/sessions-state-memory#temp-scope
  - item:agentic-ai/sessions-state-memory#inmemory-in-production
  - item:agentic-ai/sessions-state-memory#everything-in-prompt
tags: [agents, adk, memory]
terms: [session, events, session state, state prefix, user state, app state, temp state, long-term memory, SessionService, MemoryService]
related: [claim/memory-bank-extraction-and-scopes]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.3-sessions-state-memory.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** A **session** is one conversation: its **events** (every message, model response, tool call and result, in order) and its **state** (key-value data the agent and your code read and write). State keys carry a scope prefix: none (this session), `user:` (all of this user's sessions in the app), `app:` (all users and sessions), `temp:` (this invocation only, never persisted). Scopes beyond the session persist only if the session service does: `InMemorySessionService` loses everything on restart, while `DatabaseSessionService` and `VertexAiSessionService` (Agent Platform Sessions) persist sessions. Shared `user:`/`app:` state across sessions is documented and tested for `DatabaseSessionService`; for `VertexAiSessionService` the ADK client sends state unchanged and does not implement `get_user_state`, which shows only that a standalone user-state lookup is unavailable, not that sharing fails. ADK's state guide names Vertex AI persistence; no live two-session test has confirmed it yet (open point for review).

**Long-term memory** is a separate, searchable store across sessions, reached through a memory service: finished sessions (or events) are added to it, and the agent retrieves from it with `preload_memory` (every turn) or `load_memory` (when the model asks). Use `user:` or `app:` state for values your code owns and reads exactly; use memory for facts users mention that you did not model as fields; never paste whole histories into the prompt.

**Canonical terms.** session, event, session state, state prefix, SessionService, MemoryService, long-term memory.
