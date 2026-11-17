---
id: concept/trajectory-match-modes
type: concept
status: proposed
title: "Trajectory match modes: EXACT, IN_ORDER and ANY_ORDER, and what each can see"
scope: "ADK (Python) tool_trajectory_avg_score as documented and implemented on main, retrieved 2026-11-17; argument comparison is on unless the criterion's ignore_args is set, which the docs do not describe"
sources:
  - "ADK documentation, \"Evaluation criteria\", github.com/google/adk-docs/blob/main/docs/evaluate/criteria.md (retrieved 2026-11-17: the three match types, EXACT by default; each invocation scores 1.0 on a match and 0.0 otherwise, averaged across the case)"
  - "adk-python, src/google/adk/evaluation/trajectory_evaluator.py (retrieved 2026-11-17: calls are equal when name and arguments are equal; EXACT requires equal length and pairwise equality; IN_ORDER walks the expected list as a subsequence; ANY_ORDER finds each expected call once in the actual list)"
touches:
  - agentic-ai/agent-eval-criteria
  - sim:trajectory-match-explorer
tags: [agents, evaluation, adk]
terms: [tool trajectory match, EXACT, IN_ORDER, ANY_ORDER, tool_trajectory_avg_score]
related: [concept/agent-evalset, misconception/llm-judge-checks-tool-calls]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.4-agent-eval-criteria.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** By default (unless `ignore_args` is set), a tool call matches an expected one only when its name and arguments are equal. **EXACT** (the default) needs the same calls in the same order with nothing extra or missing. **IN_ORDER** needs every expected call as an ordered subsequence, allowing extra calls between. **ANY_ORDER** needs every expected call somewhere, each actual call used once, in any order, allowing extras. Each turn scores 1.0 or 0.0 and the case score is the average.

**What each can see.** EXACT flags every deviation, including harmless extra lookups. IN_ORDER catches an order violation among the expected calls but not extra calls, whatever they do: it passes a run with an extra $600 refund after the expected sequence, and a run that refunds first and then makes the full expected sequence, because it only needs one matching ordered subsequence. A rule about every call of a tool (every refund follows a policy check) needs a separate deterministic check over all calls, or EXACT with the full sequence. ANY_ORDER catches only a missing (or mismatched) call: it passes a run that refunds before checking the policy. All three catch a wrong argument, because the mismatched call no longer counts as the expected one. Choose the loosest mode that still fails the runs you care about.

**Edge case.** With an empty expected list, EXACT requires zero calls, while IN_ORDER and ANY_ORDER pass any run.

**Canonical terms.** tool trajectory match, EXACT, IN_ORDER, ANY_ORDER.
