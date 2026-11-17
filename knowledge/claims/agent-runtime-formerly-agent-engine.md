---
id: claim/agent-runtime-formerly-agent-engine
type: claim
status: proposed
title: "Agent Runtime is the current name of Vertex AI Agent Engine"
scope: "Google Cloud product names in the Professional Agentic Architect exam guide, as of November 2026"
sources:
  - "Google Cloud, Professional Agentic Architect exam guide, services.google.com/fh/files/misc/professional_agentic_architect_exam_guide_english.pdf (in-scope tools: \"Agent Runtime (formerly Agent Engine)\")"
  - "Google Cloud docs, docs.cloud.google.com/agent-builder/agent-engine/overview (now resolves to the Agent Platform scale pages)"
touches:
  - agentic-ai/google-agent-platform-map
  - objective:agentic-ai/google-agent-platform-map#former-names
  - item:agentic-ai/google-agent-platform-map#former-agent-engine
  - item:agentic-ai/google-agent-platform-map#rename-agent-engine
tags: [google-cloud, product-names]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/0.2-google-agent-platform-map.md"
reviewed: 2026-11-17
review-by: 2027-02-17
---

**Claim.** The managed runtime for deployed agents, once Vertex AI Agent Engine, is called Agent Runtime in the current exam guide and Google's Agent Platform documentation.

**Limits.** The API resource keeps the name `ReasoningEngine`. Sessions and Memory Bank are separate Agent Platform services used with it. The name already appears in Google's 22 April 2026 Agent Platform announcement (cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform); the exam guide gives no date for the rename. Older tutorials, SDK names and URLs still say Agent Engine; they refer to the same product. Re-check before each publish: this is the path's highest-churn area.
