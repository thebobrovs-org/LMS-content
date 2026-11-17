---
id: claim/adk-built-in-eval-criteria
type: claim
status: proposed
title: "ADK's built-in evaluation criteria, their defaults, and the efficiency criteria that never fail a case"
scope: "ADK (Python) evaluation as documented on 2026-11-17 (adk-docs main). Criterion names carry version suffixes and can change; re-check before quizzing a name"
sources:
  - "ADK documentation, \"Why evaluate agents\", section \"Evaluation criteria\", github.com/google/adk-docs/blob/main/docs/evaluate/index.md (retrieved 2026-11-17: the list of criteria; defaults tool_trajectory_avg_score 1.0 and response_match_score 0.8 when no criteria are given; efficiency criteria report a value but never pass or fail an eval case)"
  - "ADK documentation, \"Evaluation criteria\", github.com/google/adk-docs/blob/main/docs/evaluate/criteria.md (retrieved 2026-11-17: what each criterion measures; efficiency criteria are always on, their status is always INFORMATIONAL, and a threshold set on one is rejected)"
touches:
  - agentic-ai/agent-quality-basics
tags: [agents, evaluation, adk]
terms: [tool_trajectory_avg_score, response_match_score, final_response_match_v2, hallucinations_v1, safety_v1, efficiency criteria]
related: [concept/agent-quality-dimensions]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.1-agent-quality-basics.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** ADK ships built-in evaluation criteria that include `tool_trajectory_avg_score` (the tool-call trajectory against the expected one), `response_match_score` (ROUGE-1 similarity to a reference response), `final_response_match_v2` (an LLM-judged semantic match to a reference), rubric-based criteria for response quality and tool use, `hallucinations_v1` (LLM-judged groundedness against the context, such as tool outputs) and `safety_v1` (harmlessness). If no criteria are configured, ADK uses `tool_trajectory_avg_score` at 1.0 (a full trajectory match) and `response_match_score` at 0.8.

**Efficiency criteria.** `tool_call_count_v1`, `inference_call_count_v1`, `token_usage_v1` and `invocation_duration_v1` are reported for every eval without configuration. They report a value but never pass or fail an eval case.

**Limits.** Some criteria (response quality, safety, multi-turn quality) call Google Cloud's Gen AI evaluation service (the docs name it the Vertex Gen AI Evaluation Service API and, for `safety_v1`, the Agent Platform Eval SDK). Names and defaults are product facts with version suffixes; this record is reviewed every 90 days.
