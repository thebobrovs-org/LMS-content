---
id: concept/agent-vs-workflow
type: concept
status: proposed
title: "Chatbot, workflow or agent: who decides the next step"
scope: "Choosing an architecture for an LLM-powered task, using workflow in Anthropic's narrow sense (designer-defined paths); ADK calls any multi-agent or multi-node app a workflow"
sources:
  - "Anthropic, \"Building effective agents\", anthropic.com/engineering/building-effective-agents (workflows: predefined code paths; agents: the model directs its own process; start with the simplest solution)"
  - "ADK documentation, \"Agents\", section \"Grow from single agent to workflows\", github.com/google/adk-docs/blob/main/docs/agents/index.md (mixing deterministic and non-deterministic tasks)"
  - "ADK documentation, \"Workflows\", github.com/google/adk-docs/blob/main/docs/workflows/index.md (any application with more than one agent or executable node is a workflow; collaborative workflows with a coordinating agent)"
  - "Google Cloud, \"What is an AI agent?\", cloud.google.com/discover/what-are-ai-agents (AI agents vs AI assistants vs bots)"
tags: [agents, architecture]
terms: [workflow, chatbot, determinism, autonomy]
related: [concept/agent, misconception/every-llm-app-is-an-agent]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/0.1-what-is-an-agent.md"
reviewed: 2026-11-17
review-by: 2027-11-17
---

**Concept.** Three designs, told apart by who controls the path:

- **Chatbot:** answers each message and acts only when asked; the user decides every next step.
- **Workflow:** the designer laid out the paths in advance; models may fill steps or pick between predefined branches (routing), but never invent the path; predictable and easy to test.
- **Agent:** the model directs its own steps and tool use at run time; flexible for tasks whose path cannot be known in advance, at the cost of predictability, latency, cost and testing effort.

**The rule.** Use the least autonomy that solves the task: a workflow when the steps are known, an agent only where they are not. Real systems mix them (deterministic steps around an agentic one).

**Two meanings of workflow.** ADK's docs call any application with more than one agent or executable node a workflow, including LLM agents that route between themselves. Name which sense you mean.

**Canonical terms.** workflow, chatbot, assistant, agent, determinism spectrum.
