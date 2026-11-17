---
id: concept/agent
type: concept
status: proposed
title: "An agent is a model that directs its own steps, in a loop, with tools"
scope: "LLM-based agents as Google Cloud and ADK describe them; not classical reinforcement-learning agents"
sources:
  - "ADK documentation, \"Agents\", github.com/google/adk-docs/blob/main/docs/agents/index.md (an LlmAgent's basic components: a model, task instructions and optionally tools)"
  - "Google Cloud, \"What is an AI agent?\", cloud.google.com/discover/what-are-ai-agents (last updated 2026-04-02; definition, and agent vs assistant vs bot table)"
  - "Anthropic, \"Building effective agents\", anthropic.com/engineering/building-effective-agents (agents dynamically direct their own processes and tool usage)"
tags: [agents]
terms: [agent, LlmAgent, tool, instructions, autonomy]
related: [concept/agent-vs-workflow]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/0.1-what-is-an-agent.md"
reviewed: 2026-11-17
review-by: 2027-11-17
---

**Concept.** An LLM-based agent has four parts: a **model** that reasons, **instructions** that set its goal and limits, **tools** that let it read data or act (functions, APIs, other agents), and a **loop** in which the model chooses the next tool call, sees the result and decides again until it can answer. ADK names the first three as an agent's basic components (model, task instructions, optionally tools); the loop is how its runtime executes them. State (session history, memory) lets the loop carry what it has learned between turns.

**What makes it an agent.** The model directs its own steps and tool use at run time; the developer does not lay out the path. A program whose path is designed in advance (even one where a model picks between predefined branches) is a workflow, not an agent, however smart each call is.

**Canonical terms.** agent, LlmAgent, model, instructions, tool, agent loop, state.
