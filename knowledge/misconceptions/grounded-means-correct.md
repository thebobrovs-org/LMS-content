---
id: misconception/grounded-means-correct
type: misconception
status: proposed
title: "A grounded answer is a correct answer"
scope: "Architects and engineers building retrieval-augmented agents"
sources:
  - "Google Cloud, \"Use metadata search\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/use-metadata-search (retrieved 2026-11-17; metadata_filter on RAG Engine retrieval, a CEL expression; in Preview, v1beta1 API only, not supported in serverless mode, requires a RagDataSchema on the corpus)"
  - "Google Cloud, \"RAG Engine overview\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/rag-overview (retrieved 2026-11-17; generation uses the retrieved content)"
touches:
  - agentic-ai/rag-pipelines
  - objective:agentic-ai/rag-pipelines#grounded-but-wrong
  - item:agentic-ai/rag-pipelines#grounded-but-wrong-card
  - item:agentic-ai/rag-pipelines#stale-policy-fix
  - item:agentic-ai/rag-pipelines#diagnose-grounded-wrong
tags: [agents, rag, grounding]
related: [concept/rag-pipeline]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.4-rag-pipelines.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**The model.** "The answer cites our documents, so it is right."

**How it shows.** A learner treats grounding as a guarantee and, when a cited answer is wrong, reaches for the prompt ("prefer the newest document"), a bigger model or a higher top-k. None of these stop a superseded document from being retrieved; a higher top-k can bring both versions in, and the model may follow the higher-ranked old one. A reranker does not help either, because it scores relevance, and the old document is just as relevant.

**The correcting example.** A corpus holds the 2024 refund FAQ (60 days) and the 2026 returns policy (30 days). The FAQ repeats the question's wording and ranks first, so the agent answers "60 days" and cites it. The fix is at the data layer: archive or mark superseded documents at ingestion (status, effective date) and filter retrieval on that metadata, so only current documents can ground the answer.
