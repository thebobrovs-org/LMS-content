---
id: concept/rag-pipeline
type: concept
status: proposed
title: "A RAG pipeline: ingest, chunk, embed, index, retrieve (and rerank), generate"
scope: "Retrieval-augmented generation for agents, with Google Cloud's RAG Engine as the worked example, as documented in November 2026"
sources:
  - "Google Cloud, \"RAG Engine overview\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/rag-overview (retrieved 2026-11-17; stages: data ingestion, data transformation, embedding, data indexing, retrieval, generation)"
  - "Google Cloud, \"Fine-tune RAG transformations\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/fine-tune-rag-transformations (retrieved 2026-11-17; chunk_size default 1,024 tokens, chunk_overlap default 256 tokens)"
  - "Google Cloud, \"Retrieval and ranking\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/rag-engine/retrieval-and-ranking (retrieved 2026-11-17; RagRetrievalConfig top_k; ranking API reranker under 100 ms; LLM reranker 1 to 2 seconds, Gemini models only)"
touches:
  - agentic-ai/rag-pipelines
  - objective:agentic-ai/rag-pipelines#rag-stages
  - objective:agentic-ai/rag-pipelines#tune-retrieval
  - item:agentic-ai/rag-pipelines#rag-stages-card
  - item:agentic-ai/rag-pipelines#what-reranking-does
  - item:agentic-ai/rag-pipelines#topk-noise
  - item:agentic-ai/rag-pipelines#chunk-too-large
  - item:agentic-ai/rag-pipelines#exception-missed
  - item:agentic-ai/rag-pipelines#stage-for-scans
  - item:agentic-ai/rag-pipelines#stage-for-status
  - item:agentic-ai/rag-pipelines#chunk-size-tradeoff
  - item:agentic-ai/rag-pipelines#reranker-latency
tags: [agents, rag, retrieval]
terms: [RAG, embedding, top-k, reranking, chunk size, chunk overlap]
related: [misconception/grounded-means-correct, claim/rag-engine-retrieval-defaults]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.4-rag-pipelines.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**Concept.** A RAG pipeline gives a model content it was not trained on. Ahead of time it **ingests** documents (loading and parsing them, including scans), **chunks** them into passages, **embeds** each chunk as a vector and **indexes** the vectors with metadata. On each question it embeds the query, **retrieves** the closest chunks, optionally **reranks** a wider candidate set with a stronger relevance model, keeps the top-k and **generates** an answer from them.

**Why it matters.** Retrieval quality caps answer quality: a chunk that never reaches the model cannot inform the answer, and a wrong chunk that does is repeated faithfully. Chunk size trades precision (small) against keeping related sentences together (large); top-k trades recall against noise and tokens; reranking improves relevance without adding chunks, but measures relevance, not freshness or truth.

**Limits.** The stage names follow the RAG Engine documentation; other products group them differently (for example, transformation covers chunking). Default values are vendor settings that can change.
