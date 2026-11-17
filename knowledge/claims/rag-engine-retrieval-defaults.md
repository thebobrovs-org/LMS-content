---
id: claim/rag-engine-retrieval-defaults
type: claim
status: proposed
title: "RAG Engine chunks at 1,024 tokens with a 256-token overlap by default, and offers a ranking API reranker (under 100 ms) and an LLM reranker (1 to 2 s)"
scope: "RAG Engine on Gemini Enterprise Agent Platform, as documented on 2026-11-17"
sources:
  - "Google Cloud, \"Fine-tune RAG transformations\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/fine-tune-rag-transformations (retrieved 2026-11-17; chunk_size default 1,024 tokens; chunk_overlap default 256 tokens)"
  - "Google Cloud, \"Retrieval and ranking\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/retrieval-and-ranking (retrieved 2026-11-17; rank service: semantic reranker, latency under 100 ms; LLM reranker: a separate Gemini call, latency 1 to 2 seconds, Gemini models only)"
  - "Google Cloud, \"Vector database choices in RAG Engine\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/vector-db-choices (retrieved 2026-11-17; RagManagedDb default; Vector Search, Feature Store, Weaviate, Pinecone)"
touches:
  - agentic-ai/rag-pipelines
  - objective:agentic-ai/rag-pipelines#tune-retrieval
  - objective:agentic-ai/rag-pipelines#choose-backend
  - item:agentic-ai/rag-pipelines#reranker-latency
  - item:agentic-ai/rag-pipelines#backend-rag-engine
tags: [agents, rag, agent-platform]
terms: [RAG Engine, chunk_size, chunk_overlap, ranking API, LLM reranker]
related: [concept/rag-pipeline]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.4-rag-pipelines.md"
reviewed: 2026-11-17
review-by: 2027-02-17
---

**Claim.** RAG Engine's default chunking is 1,024 tokens per chunk with a 256-token overlap. For reranking it offers the ranking API (a dedicated semantic reranker, latency under 100 ms) and an LLM reranker (a separate Gemini call, latency of one to two seconds, Gemini models only). Its vector database is RagManagedDb by default, with Vector Search, Feature Store, Weaviate and Pinecone among the alternatives.

**Limits.** Vendor defaults and latency figures as documented; re-check by the review date. Latency depends on candidate count and load.
