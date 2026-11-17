---
id: claim/adk-telemetry-defaults
type: claim
status: proposed
title: "ADK elides prompt content from its logs by default, and RunConfig caps model calls per run at 500 by default"
scope: "ADK (Python) as documented on 2026-11-17 (adk-docs main). Defaults are product facts that can change; re-check before quizzing a number"
sources:
  - "ADK documentation, \"Agent activity logging\", github.com/google/adk-docs/blob/main/docs/observability/logging.md (retrieved 2026-11-17: \"By default prompt content is elided in logs for security\"; OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true turns capture on)"
  - "ADK documentation, \"Runtime configuration\", github.com/google/adk-docs/blob/main/docs/runtime/runconfig.md (retrieved 2026-11-17: \"max_llm_calls: Caps the total number of LLM calls per run (default: 500)\")"
touches:
  - agentic-ai/agent-observability-troubleshooting
tags: [agents, observability, adk]
terms: [max_llm_calls]
related: [concept/agent-failure-modes]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.5-agent-observability-troubleshooting.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** ADK leaves prompt content out of its logs by default, for security. Setting `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true` (or the per-run content-capture option) turns capture on, which stores what users said.

**Claim.** `RunConfig.max_llm_calls` caps the total number of model calls in one run, and defaults to 500. It is a safety net that ends a runaway reasoning loop; it does not fix the loop's cause.

**Limits.** Both are defaults of the Python ADK on the date above. The lesson states them but does not quiz the number; this record is reviewed every 90 days.
