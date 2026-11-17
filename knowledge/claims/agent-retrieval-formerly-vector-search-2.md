---
id: claim/agent-retrieval-formerly-vector-search-2
type: claim
status: proposed
title: "Agent Retrieval is the current name of Vector Search 2.0; Vector Search remains a separate product"
scope: "Google Cloud product names, as of November 2026"
sources:
  - "Google Cloud, Agent Retrieval overview, docs.cloud.google.com/vertex-ai/docs/vector-search-2/overview (titled Agent Retrieval, formerly Vector Search 2.0)"
  - "Google Cloud, Agent Search release notes, docs.cloud.google.com/generative-ai-app-builder/docs/release-notes (entry of 15 May 2026 already uses the name Agent Retrieval, formerly Vector Search 2.0)"
  - "Google Cloud, Professional Agentic Architect exam guide, services.google.com/fh/files/misc/professional_agentic_architect_exam_guide_english.pdf (in-scope tools: \"Agent Retrieval and Vector Search\")"
touches:
  - agentic-ai/google-agent-platform-map
  - objective:agentic-ai/google-agent-platform-map#former-names
  - item:agentic-ai/google-agent-platform-map#rename-vector-search-2
  - item:agentic-ai/google-agent-platform-map#former-vertex-ai-search
  - agentic-ai/rag-pipelines
  - item:agentic-ai/rag-pipelines#backend-custom-embeddings
tags: [google-cloud, product-names]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/0.2-google-agent-platform-map.md"
reviewed: 2026-11-17
review-by: 2027-02-17
---

**Claim.** Vector Search 2.0 is called Agent Retrieval, a name in use by 15 May 2026 (Google gives no rename date). The original Vector Search keeps its name and documentation as a separate product; the exam guide lists the two together.

**Limits.** Do not read Agent Retrieval as a rename of Agent Search or of Vertex AI Search; it is the embedding store and search product. Unlike the original Vector Search, it stores documents with their vectors and can generate embeddings with built-in models (or take your own), per its overview at docs.cloud.google.com/vertex-ai/docs/vector-search-2/overview; it also offers semantic reranking (VertexRanker), per docs.cloud.google.com/gemini-enterprise-agent-platform/build/vector-search-2/query-search/reranking.
