---
id: claim/gen-ai-evaluation-service-metrics
type: claim
status: proposed
title: "The Gen AI evaluation service offers rubric-based (including adaptive), computation-based and custom function metrics, and online monitors for live traces"
scope: "Gemini Enterprise Agent Platform's Gen AI evaluation service, November 2026. The author read page descriptions and fetch summaries; a PR #151 reviewer then read the page bodies and confirmed the claims below, with the section references given in the sources. Not yet signed off by a human"
sources:
  - "Google Cloud, \"Gen AI evaluation service overview\", docs.cloud.google.com/gemini-enterprise-agent-platform/models/evaluation-overview (page description, retrieved 2026-11-17: measure generative model quality using test-driven evaluation and adaptive rubrics)"
  - "Google Cloud, \"Determine evaluation metrics\", docs.cloud.google.com/gemini-enterprise-agent-platform/models/determine-eval (retrieved 2026-11-17; confirmed from the page body by the PR #151 reviewer: rubric-based, computation-based and custom-function metrics)"
  - "Google Cloud, \"Details for managed rubric-based metrics\", docs.cloud.google.com/gemini-enterprise-agent-platform/models/rubric-metric-details (retrieved 2026-11-17; Overview section, docs.cloud.google.com/gemini-enterprise-agent-platform/models/rubric-metric-details#overview, confirmed from the page body by the PR #151 reviewer: most adaptive metrics include per-prompt rubric generation and validation, which can run separately; static metrics do not generate per-prompt rubrics)"
  - "Google Cloud, \"Evaluate agents online\", docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/evaluation/evaluate-online (last updated 2026-11-12, retrieved 2026-11-17; confirmed from the page body by the PR #151 reviewer: asynchronous evaluation of live traces with predefined and custom metrics, a configurable sampling percentage and sample caps)"
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

**Claim.** Agent Platform's Gen AI evaluation service is managed evaluation for models and agents. It offers rubric-based metrics (static rubrics, and adaptive rubrics, which most adaptive metrics generate and validate for each prompt), computation-based metrics and custom function metrics, scored where needed by a judge model. Online monitors score a sample of a deployed agent's live traces with predefined and custom metrics. Some ADK judged criteria call the service.

**Limits.** The page bodies were confirmed by a reviewer on PR #151, not by the author directly. Keep the qualifier "most" when describing the adaptive workflow. The lesson states no launch stage. Quiz no metric name or stage from this record until it is approved.
