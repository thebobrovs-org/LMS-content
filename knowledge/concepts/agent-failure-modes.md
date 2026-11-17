---
id: concept/agent-failure-modes
type: concept
status: proposed
title: "Agents fail in their own ways, and each failure leaves a different mark in telemetry"
scope: "Tool-calling LLM agents in production, instrumented with OpenTelemetry GenAI traces and metrics as ADK emits them; the six-symptom grouping and the fix guidance are this path's teaching frame, not a vendor taxonomy"
sources:
  - "ADK documentation, \"Agent activity traces\", github.com/google/adk-docs/blob/main/docs/observability/traces.md (retrieved 2026-11-17: OpenTelemetry GenAI semantic conventions; invoke_agent, generate_content and execute_tool spans; export to Cloud Trace)"
  - "ADK documentation, \"Evaluation criteria\", github.com/google/adk-docs/blob/main/docs/evaluate/criteria.md (retrieved 2026-11-17: hallucinations_v1 checks that a response is grounded in the context, such as tool outputs; judged quality criteria score responses)"
  - "ADK documentation, \"Agent activity metrics\", github.com/google/adk-docs/blob/main/docs/observability/metrics.md (retrieved 2026-11-17: gen_ai.invoke_agent.duration, gen_ai.execute_tool.duration per tool, gen_ai.invoke_agent.inference_calls and tool_calls per invocation, gen_ai.client.token.usage per model call; export to Cloud Monitoring)"
touches:
  - agentic-ai/agent-observability-troubleshooting
tags: [agents, observability, operations]
terms: [span, reasoning loop, drift]
related: [concept/agent-quality-dimensions, claim/adk-telemetry-defaults, misconception/timeout-fixes-agent-loop]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.5-agent-observability-troubleshooting.md"
reviewed: 2026-11-17
review-by: 2027-11-17
---

**Concept.** An agent's failures happen inside its loop of model calls and tool calls, so ordinary service metrics (uptime, error rate) often stay green while it fails. This path groups the failures into six symptoms, each with a signal that confirms it:

- **Slow turns:** long `execute_tool` spans (a slow tool or downstream API), or many model calls per turn.
- **Reasoning loop:** the same tool call repeated with the same arguments, each followed by a model call, and high tool-call and model-call counts per invocation.
- **Drift:** quality scores falling on a sample of live responses, or new failures when the offline evaluation dataset is re-run after a model, prompt, tool or data change, while latency and errors stay flat.
- **Errors:** an error type on spans, and error rates by tool or model.
- **Hallucination:** a claim in the reply that no tool or retrieval span returned.
- **Rising cost:** token usage per model call and per turn, and model calls per turn.

**Reading a trace.** Two passes: first find the longest spans (where the time went), then look for repeated calls (where the agent made no progress). Repeated calls that return unchanged results with no progress can indicate a reasoning loop rather than a slow tool, even though each call is fast; polling a changing job status or a bounded retry can legitimately repeat the same tool and arguments.

**Fixes follow causes.** A loop is fixed by making the tool's result unambiguous, telling the model when to stop and capping model calls per run; a slow tool by caching it or running it in parallel; drift by scoring answers live and offline and pinning model versions; cost by sending less context.
