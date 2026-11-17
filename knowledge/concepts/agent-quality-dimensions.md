---
id: concept/agent-quality-dimensions
type: concept
status: proposed
title: "Agent quality has several dimensions, and the path counts as much as the answer"
scope: "Evaluating LLM agents that call tools, as ADK frames it; the six dimensions are this path's teaching grouping, each mapped to built-in ADK criteria"
sources:
  - "ADK documentation, \"Why evaluate agents\", github.com/google/adk-docs/blob/main/docs/evaluate/index.md (agent evaluation has two components, trajectory and tool use, and the final response; the list of built-in criteria, including hallucinations_v1, safety_v1 and the efficiency criteria; success criteria \"guide the creation of evaluation scenarios and enable effective monitoring of agent behavior in real-world deployments\")"
  - "ADK documentation, \"Agent activity traces\", github.com/google/adk-docs/blob/main/docs/observability/traces.md (traces of live runs, with spans for agent invocations, model calls and tool executions, exportable to Cloud Trace)"
touches:
  - agentic-ai/agent-quality-basics
tags: [agents, evaluation]
terms: [trajectory, offline evaluation, online monitoring, quality dimensions, groundedness]
related: [concept/agent, claim/adk-built-in-eval-criteria]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.1-agent-quality-basics.md"
reviewed: 2026-11-17
review-by: 2027-11-17
---

**Concept.** An agent run can fail in ways a final-answer check never sees. This path groups agent quality into six dimensions: the **final response** (is it correct, relevant and complete), the **trajectory** (did it call the right tools, with the right arguments, in an acceptable order, and only tools it was allowed to use), **grounding** (are its claims supported by what its tools and retrieval returned), **safety** (is the output harmless and within policy), **latency** and **cost** (how long the turn took, and how many model calls, tool calls and tokens it spent). ADK frames evaluation as two components, trajectory and final response, and its built-in criteria cover the other four: `hallucinations_v1` for grounding, `safety_v1` for safety, and the efficiency criteria for latency and cost.

**Right answer, wrong way.** A refund agent can tell the customer "your refund of $240 has been issued" (a correct, polite, grounded final response) after calling `issue_refund` without the approval step its policy requires. A response-only eval passes this run; a trajectory check fails it.

**Offline and online.** Offline evaluation runs the agent on a fixed dataset (an ADK test file or evalset) before release, so changes can be compared and regressions caught. Online monitoring measures the deployed agent on live traffic, through traces, logs and metrics, because live inputs differ from any dataset and models, prompts, tools and data change after launch. Both are needed; neither replaces the other.

**Canonical terms.** trajectory, final response, grounding, safety, latency, cost, offline evaluation, online monitoring.
