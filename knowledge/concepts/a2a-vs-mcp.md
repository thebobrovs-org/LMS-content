---
id: concept/a2a-vs-mcp
type: concept
status: proposed
title: "MCP connects an agent to tools; A2A connects independent agents"
scope: "Agent integration protocols, as specified in November 2026 (A2A 1.0)"
sources:
  - "A2A Project, \"A2A and MCP\", a2a-protocol.org/latest/topics/a2a-and-mcp (retrieved 2026-11-17; \"MCP is vertical. It deepens a single agent.\" \"A2A is horizontal. It connects agents across that boundary.\" \"A2A is about agents partnering on tasks; MCP is more about agents using capabilities.\")"
  - "A2A Project, \"A2A Protocol Specification\", version 1.0.0, a2a-protocol.org/v1.0.0/specification (retrieved 2026-11-17; core concepts: agent card, task, message, part, artifact; task states; opaque agents)"
  - "Google, ADK documentation, A2A quickstarts, github.com/google/adk-docs/tree/main/docs/a2a (retrieved 2026-11-17; to_a2a; RemoteA2aAgent)"
touches:
  - agentic-ai/a2a-and-mcp
  - objective:agentic-ai/a2a-and-mcp#a2a-vs-mcp
  - objective:agentic-ai/a2a-and-mcp#local-vs-remote
  - item:agentic-ai/a2a-and-mcp#a2a-vs-mcp-card
  - item:agentic-ai/a2a-and-mcp#vertical-horizontal
  - item:agentic-ai/a2a-and-mcp#when-remote
  - item:agentic-ai/a2a-and-mcp#reuse-fraud-agent
  - item:agentic-ai/a2a-and-mcp#mcp-for-inventory
  - item:agentic-ai/a2a-and-mcp#a2a-follow-up
  - item:agentic-ai/a2a-and-mcp#opaque-remote
  - item:agentic-ai/a2a-and-mcp#same-team-specialist
  - item:agentic-ai/a2a-and-mcp#helper-returns-result
tags: [agents, a2a, mcp, multi-agent]
terms: [A2A, MCP, agent card, remote agent, task]
related: [concept/subagent-vs-agenttool, claim/a2a-agent-card-discovery]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.6-a2a-and-mcp.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**Concept.** MCP is agent-to-tool: an agent calls a declared function with typed arguments and gets a result. A2A is agent-to-agent: a client sends messages to a remote agent that keeps its own model, tools and state private and works on a stateful task (submitted, working, input-required, completed and other states), returning artifacts. In ADK, a sub-agent or AgentTool runs in your own process; a `RemoteA2aAgent` reaches another service over A2A.

**Why it matters.** Wrapping another team's agent as an MCP tool hides its follow-up questions and long-running work behind one call; calling a plain query over A2A adds a second agent for nothing. Go remote when another team owns, deploys, scales or secures the agent.

**Limits.** Many systems use both: each agent uses MCP for its tools and A2A to work with other agents.
