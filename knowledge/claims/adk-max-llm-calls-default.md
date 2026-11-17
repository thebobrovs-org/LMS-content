---
id: claim/adk-max-llm-calls-default
type: claim
status: proposed
title: "ADK caps model calls per run with RunConfig.max_llm_calls, 500 by default"
scope: "ADK run_async() runs (Python, TypeScript, Go, Java, Kotlin), as documented on 2026-11-17. Not run_live()"
sources:
  - "ADK documentation, \"Runtime configuration\", section \"Configure runtime limits and debugging\", github.com/google/adk-docs/blob/main/docs/runtime/runconfig.md (retrieved 2026-11-17; max_llm_calls caps the total number of LLM calls per run, default 500; 0 or negative means unlimited, not recommended for production)"
  - "adk-python source, src/google/adk/agents/invocation_context.py and src/google/adk/agents/run_config.py, github.com/google/adk-python (main, retrieved 2026-11-17; LlmCallsLimitExceededError when the count exceeds max_llm_calls; ADK_MAX_LLM_CALLS default override)"
  - "ADK documentation, \"Live configuration\", section \"max_llm_calls\", github.com/google/adk-docs/blob/main/docs/live/configuration.md (retrieved 2026-11-17; does not apply to run_live())"
touches:
  - agentic-ai/the-agent-loop
  - objective:agentic-ai/the-agent-loop#stop-conditions
  - item:agentic-ai/the-agent-loop#stop-conditions-card
  - checkpoint:agent-loop-stepper/observe-loop-cap
tags: [agents, adk]
terms: [max_llm_calls, RunConfig, max iterations]
related: [concept/function-calling]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.1-the-agent-loop.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** In ADK, `RunConfig(max_llm_calls=N)` passed to `runner.run_async()` caps the total number of model calls in one run. The documented default is 500. Setting it to 0 or a negative number removes the cap, which the docs advise against in production.

**Limits.** It is a safety net for runaway loops, not a design: 500 model calls is far more than a typical support turn needs, so production agents set a cap sized to the task. It does not guard `run_live()` sessions. When the cap is passed, ADK raises an error rather than ending quietly (`LlmCallsLimitExceededError` in Python, adk-python `src/google/adk/agents/invocation_context.py`), so the caller must catch it and give the user a fallback. In Python the default can be overridden with the `ADK_MAX_LLM_CALLS` environment variable (`run_config.py`). A `LoopAgent`'s `max_iterations` is a separate cap on a workflow loop (topic 3.7).
