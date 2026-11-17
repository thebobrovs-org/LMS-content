---
id: concept/subagent-vs-agenttool
type: concept
status: proposed
title: "A sub-agent receives control; an AgentTool returns a result to its caller"
scope: "ADK multi-agent composition within one app, as documented on 2026-11-17. Remote agents over A2A are topic 3.6"
sources:
  - "ADK documentation, \"Function tools\", section \"Agent-as-a-Tool\" / \"Key difference from sub-agents\", github.com/google/adk-docs/blob/main/docs/tools-custom/function-tools.md (retrieved 2026-11-17; AgentTool: the answer is passed back and the caller retains control; sub-agent: responsibility is transferred and subsequent input is answered by the sub-agent; Python note preferring a single_turn sub-agent for inline delegation)"
  - "ADK documentation, \"Custom agents\", section \"LLM delegation and agent transfer\", github.com/google/adk-docs/blob/main/docs/agents/custom-agents.md (retrieved 2026-11-17; transfer_to_agent; distinct descriptions required)"
  - "ADK documentation, \"Build collaborative agent teams\", github.com/google/adk-docs/blob/main/docs/workflows/collaboration.md (retrieved 2026-11-17; ADK 2.0 Python and Go modes chat (default, manual return), task (clarifications, automatic return via finish_task) and single_turn (no user interaction, automatic return, can run in parallel))"
touches:
  - agentic-ai/adk-agents-and-tools
  - objective:agentic-ai/adk-agents-and-tools#compose-agents
  - item:agentic-ai/adk-agents-and-tools#subagent-vs-agenttool
  - item:agentic-ai/adk-agents-and-tools#transfer-or-agenttool
  - item:agentic-ai/adk-agents-and-tools#who-answers-next
tags: [agents, adk, multi-agent]
terms: [sub-agent, AgentTool, transfer_to_agent, chat mode, task mode, single_turn]
related: [concept/adk-llmagent]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.2-adk-agents-and-tools.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** Two ways to attach one ADK agent to another differ in control. A **sub-agent** (listed in `sub_agents`) receives control when the parent's model transfers to it (`transfer_to_agent`, chosen from the sub-agents' descriptions); in the default chat mode it answers the user from then on, until control is transferred again. An **AgentTool** wraps an agent so the parent calls it like a function: the wrapped agent's answer returns to the parent, which keeps control and writes the reply.

**ADK 2.0 modes.** In Python and Go, a sub-agent can set `mode`: `chat` (default; manual return by transfer), `task` (may ask the user clarifying questions; returns automatically via `finish_task`) or `single_turn` (no user interaction; returns immediately with its result; can run in parallel). For inline delegation in Python the docs suggest a `single_turn` sub-agent over an `AgentTool`.

**Choosing.** Use a chat-mode sub-agent when the specialist should own the conversation for a while; use an AgentTool (or a single-turn sub-agent) when the parent needs a result to fold into its own reply.
