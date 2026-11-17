---
id: concept/orchestration-patterns
type: concept
status: proposed
title: "Orchestration patterns: sequential, parallel, loop, graph and LLM-routed"
scope: "Multi-agent orchestration, with ADK as the worked example, as documented in November 2026"
sources:
  - "Google, ADK documentation, \"Workflow patterns\", github.com/google/adk-docs/blob/main/docs/workflows/patterns.md (retrieved 2026-11-17; sub-agents write results to distinct keys in shared session state; LLM-driven delegation for the coordinator pattern)"
  - "Google, ADK documentation, \"Parallel agents\", github.com/google/adk-docs/blob/main/docs/agents/workflow-agents/parallel-agents.md (retrieved 2026-11-17; \"Session state is shared: all branches run against the same session\"; give each sub-agent an output_key; do not rely on one branch reading a key another branch is still writing)"
  - "Google, ADK documentation, \"Loop agents\", github.com/google/adk-docs/blob/main/docs/agents/workflow-agents/loop-agents.md (retrieved 2026-11-17; in Python max_iterations defaults to None, so the loop only stops on escalation; tool_context.actions.escalate; exit_loop tool)"
  - "Google, ADK documentation, \"Routes\", github.com/google/adk-docs/blob/main/docs/graphs/routes.md (retrieved 2026-11-17; JoinNode fan-out and join; loops as back-edges; a cycle must contain a routed edge; a graph cycle is not bounded automatically)"
touches:
  - agentic-ai/multi-agent-orchestration
  - objective:agentic-ai/multi-agent-orchestration#pick-pattern
  - objective:agentic-ai/multi-agent-orchestration#shared-state
  - objective:agentic-ai/multi-agent-orchestration#loop-exit
  - item:agentic-ai/multi-agent-orchestration#patterns-card
  - item:agentic-ai/multi-agent-orchestration#parallel-state-rule
  - item:agentic-ai/multi-agent-orchestration#loop-rule
  - item:agentic-ai/multi-agent-orchestration#router-or-workflow
  - item:agentic-ai/multi-agent-orchestration#lost-branch-result
  - item:agentic-ai/multi-agent-orchestration#cross-branch-read
  - item:agentic-ai/multi-agent-orchestration#endless-review
  - item:agentic-ai/multi-agent-orchestration#loop-exit-signal
  - item:agentic-ai/multi-agent-orchestration#graph-cycle-bound
  - item:agentic-ai/multi-agent-orchestration#sim-collision
tags: [agents, multi-agent, workflows, adk]
terms: [sequential agent, parallel agent, loop agent, graph workflow, output_key, JoinNode]
related: [claim/adk-template-workflows-deprecated, concept/subagent-vs-agenttool]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.7-multi-agent-orchestration.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**Concept.** Use deterministic orchestration when the order of steps is known: sequential for dependent steps, parallel (fan-out and join) for independent ones, a loop for iterative improvement, and a graph for known paths that branch or loop. Use a model to route (a coordinator delegating to sub-agents) only when the next step depends on the conversation.

**Why it matters.** Parallel branches share session state, so two branches writing the same key leave only the later value; each branch needs its own key, or its output collected at a join, and no branch should read a key another is writing. Every loop needs an exit condition and a cap: ADK Python's LoopAgent has no default cap, and graph cycles are not bounded automatically.

**Limits.** The model-call limit on a run is a backstop, not a loop design.
