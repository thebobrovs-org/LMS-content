---
id: misconception/llm-judge-checks-tool-calls
type: misconception
status: proposed
title: "An LLM judge is the right way to check which tools ran, in what order, under whose identity"
scope: "Architects designing agent evaluation"
sources:
  - "ADK documentation, \"Evaluation criteria\", github.com/google/adk-docs/blob/main/docs/evaluate/criteria.md (retrieved 2026-11-17: tool_trajectory_avg_score compares tool calls deterministically; judged criteria sample a judge model and take a majority vote; rubric_based_tool_use_quality_v1 judges tool use against rubrics)"
  - "adk-python, src/google/adk/evaluation/eval_case.py (retrieved 2026-11-17: an invocation's intermediate data records tool calls with names and arguments; no identity field)"
touches:
  - agentic-ai/agent-eval-criteria
tags: [agents, evaluation]
related: [concept/trajectory-match-modes]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.4-agent-eval-criteria.md"
reviewed: 2026-11-17
review-by: 2027-11-17
---

**The model.** "Ask an LLM judge whether the agent followed the process: it can read the transcript and tell me which tools ran and in what order."

**How it shows.** A learner picks a judged criterion for a hard rule ("approval before refund"), or expects an evaluator to report the identity a tool ran as.

**The correcting example.** Which tools ran, in what order and with what arguments is recorded in the trajectory and has one right answer, so a deterministic trajectory match checks it exactly and repeatably; a judge gives a sampled opinion that can be wrong. ADK's rubric-based tool-use criterion judges tool use against rules written in words, order rules included, and earns its place when the expected trajectory cannot be written down; when it can, a trajectory match gives a fact where a judge gives an opinion. The identity behind a call is not in the trajectory at all, so neither a match nor a judge sees it: assert it from the tool's audit logs or the trace.
