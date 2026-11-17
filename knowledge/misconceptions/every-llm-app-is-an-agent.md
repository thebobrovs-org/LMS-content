---
id: misconception/every-llm-app-is-an-agent
type: misconception
status: proposed
title: "Any app that calls an LLM is an agent"
scope: "Architects and engineers new to agentic systems"
sources:
  - "Anthropic, \"Building effective agents\", anthropic.com/engineering/building-effective-agents (workflows vs agents)"
tags: [agents]
related: [concept/agent-vs-workflow]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/0.1-what-is-an-agent.md"
reviewed: 2026-11-17
review-by: 2027-11-17
---

**The model.** "It uses Gemini, so it's an agent."

**How it shows.** A learner labels a summariser, a classifier or a fixed three-step pipeline as an agent, then reaches for agent tooling and guardrails it does not need, or misses that a real agent needs them.

**The correcting example.** A pipeline that always extracts fields, then calls the model to draft a reply, then sends it for approval is a workflow: the designer fixed the order. It becomes an agent only when the model directs the path itself, choosing its own steps and tools rather than filling slots in a path the designer laid out.
