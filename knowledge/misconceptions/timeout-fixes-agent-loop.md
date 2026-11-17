---
id: misconception/timeout-fixes-agent-loop
type: misconception
status: proposed
title: "A longer timeout fixes an agent that keeps timing out in a loop"
scope: "Engineers operating tool-calling agents in production"
sources:
  - "ADK documentation, \"Runtime configuration\", github.com/google/adk-docs/blob/main/docs/runtime/runconfig.md (retrieved 2026-11-17: max_llm_calls caps model calls per run as a guard against runaway runs)"
touches:
  - agentic-ai/agent-observability-troubleshooting
  - objective:agentic-ai/agent-observability-troubleshooting#optimize
  - item:agentic-ai/agent-observability-troubleshooting#loop-timeout-trap
tags: [agents, observability, operations]
related: [concept/agent-failure-modes]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.5-agent-observability-troubleshooting.md"
reviewed: 2026-11-17
review-by: 2027-11-17
---

**The model.** "The agent runs out of time, so give it more time."

**How it shows.** Traces show the same tool called again and again with the same arguments until the request times out, and the proposed fix is to raise the timeout. The loop then runs longer, spends more tokens and still fails, only later.

**The correcting example.** The same call with the same arguments returns the same result, so more time buys only more repeats. Fix why the model repeats: make the tool's result unambiguous (an empty search says "no flights found" rather than returning nothing), tell the model when to stop or ask the user, and keep a cap on model calls per run as a safety net for loops you did not foresee.
