---
id: claim/adk-template-workflows-deprecated
type: claim
status: proposed
title: "In ADK 2.0 Python, SequentialAgent, ParallelAgent and LoopAgent are deprecated in favour of graph Workflows"
scope: "ADK Python 2.x (main branch, version 2.14.1), as documented on 2026-11-17"
sources:
  - "Google, adk-python, src/google/adk/agents/sequential_agent.py (retrieved 2026-11-17; @deprecated('SequentialAgent is deprecated in favor of Workflow and will be removed in a future version. Workflow cannot yet be used as an LlmAgent sub-agent.'); parallel_agent.py and loop_agent.py carry the same notice)"
  - "Google, ADK documentation, \"Workflow patterns\", github.com/google/adk-docs/blob/main/docs/workflows/patterns.md (retrieved 2026-11-17; in Python and TypeScript the three template agents are deprecated: constructing one emits a deprecation warning, and they are scheduled for removal)"
  - "Google, ADK documentation, \"Workflows\", github.com/google/adk-docs/blob/main/docs/workflows/index.md (retrieved 2026-11-17; graph-based workflows, ADK 2.0 and higher)"
touches:
  - agentic-ai/multi-agent-orchestration
  - objective:agentic-ai/multi-agent-orchestration#pick-pattern
  - item:agentic-ai/multi-agent-orchestration#classify-then-route
tags: [adk, workflows]
terms: [SequentialAgent, ParallelAgent, LoopAgent, Workflow]
related: [concept/orchestration-patterns]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.7-multi-agent-orchestration.md"
reviewed: 2026-11-17
review-by: 2027-02-17
---

**Claim.** In ADK Python 2.x, constructing a `SequentialAgent`, `ParallelAgent` or `LoopAgent` emits a deprecation warning: they are superseded by the graph `Workflow` class (ADK 2.0 and later) and scheduled for removal. A `Workflow` cannot yet be used as an `LlmAgent` sub-agent.

**Limits.** ADK's documentation disagrees on which languages are affected: the workflow-agents page lists Python, TypeScript, Go and Kotlin, while the patterns page lists Python and TypeScript. Java is not listed. The classes still run.
