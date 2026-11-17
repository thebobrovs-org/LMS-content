---
id: claim/gen-ai-evaluation-service-metrics
type: claim
status: proposed
title: "The Gen AI evaluation service offers rubric-based (including adaptive), computation-based and custom function metrics, and online monitors for live traces"
scope: "Gemini Enterprise Agent Platform's Gen AI evaluation service, November 2026. Read from page descriptions and fetch summaries only, because the page bodies could not be fetched verbatim; launch stages not found. Needs a reviewer to confirm on the pages"
sources:
  - "Google Cloud, \"Gen AI evaluation service overview\", docs.cloud.google.com/gemini-enterprise-agent-platform/models/evaluation-overview (page description, retrieved 2026-11-17: measure generative model quality using test-driven evaluation and adaptive rubrics)"
  - "Google Cloud, \"Determine evaluation metrics\", docs.cloud.google.com/gemini-enterprise-agent-platform/models/determine-eval (page description, retrieved 2026-11-17: rubric-based, computation-based and custom function metrics)"
  - "Google Cloud, \"Details for managed rubric-based metrics\", docs.cloud.google.com/gemini-enterprise-agent-platform/models/rubric-metric-details (page description and fetch summary, retrieved 2026-11-17: adaptive and static rubrics; adaptive metrics generate and validate rubrics per prompt; a judge model scores them)"
  - "Google Cloud, \"Evaluate agents online\", docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/evaluation/evaluate-online (last updated 2026-11-12, fetch summary: online monitors asynchronously score sampled live traces with predefined and custom metrics)"
  - "ADK documentation, \"Why evaluate agents\", github.com/google/adk-docs/blob/main/docs/evaluate/index.md (retrieved 2026-11-17: some ADK criteria require the Gen AI Evaluation Service API)"
touches:
  - agentic-ai/agent-eval-criteria
tags: [agents, evaluation, gen-ai-evaluation-service]
terms: [Gen AI evaluation service, adaptive rubrics, online monitors, custom function metric]
related: [concept/trajectory-match-modes]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.4-agent-eval-criteria.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** Agent Platform's Gen AI evaluation service is managed evaluation for models and agents. It offers rubric-based metrics (static rubrics, and adaptive rubrics generated for each prompt), computation-based metrics and custom function metrics, scored where needed by a judge model. Online monitors score a sample of a deployed agent's live traces with predefined and custom metrics. Some ADK judged criteria call the service.

**Limits.** Only page descriptions were read verbatim; the rest came from fetch summaries. Launch stages (Preview or GA) were not found; the lesson states none. Quiz no metric name or stage from this record until a reviewer confirms it.
