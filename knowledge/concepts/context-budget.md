---
id: concept/context-budget
type: concept
status: proposed
title: "An agent's context is a per-call budget: measure it by component, cut each component its own way, and verify with an evalset"
scope: "LLM agents built with ADK (Python) on Gemini, as documented on 2026-11-17 (adk-docs main, Gemini API caching page, Gemini pricing pages). The component breakdown, the order of cuts and the claim that many look-alike tools degrade tool choice are this path's teaching framing; no Google source gives a tool-count threshold"
sources:
  - "ADK documentation, \"Compress agent context for performance\", github.com/google/adk-docs/blob/main/docs/context/compaction.md (retrieved 2026-11-17: EventsCompactionConfig on the App; token-based compaction with token_threshold (compared with a model call's whole prompt token count) and event_retention_size takes priority over the sliding window of compaction_interval and overlap_size; the App must be passed to the Runner)"
  - "ADK documentation, \"Context caching with Gemini\", github.com/google/adk-docs/blob/main/docs/context/caching.md (retrieved 2026-11-17: ContextCacheConfig on the App, min_tokens default 0, ttl_seconds default 1800, cache_intervals default 10; experimental)"
  - "ADK documentation, \"MCP tools\", github.com/google/adk-docs/blob/main/docs/tools-custom/mcp-tools/index.md (retrieved 2026-11-17: tool_filter on McpToolset; 'Always supply tool_filter=[...] in McpToolset to expose only necessary actions to your LLM')"
  - "ADK documentation, \"Memory\", github.com/google/adk-docs/blob/main/docs/sessions/memory.md (retrieved 2026-11-17: the preload_memory and load_memory tools; load_memory retrieves memory when the agent decides it would be helpful)"
  - "ADK source, github.com/google/adk-python/blob/main/src/google/adk/tools/preload_memory_tool.py (retrieved 2026-11-17: process_llm_request runs on each model request and searches memory with the turn's user message); results are inserted as transient user content)"
  - "ADK source, github.com/google/adk-python/blob/main/src/google/adk/tools/load_memory_tool.py and src/google/adk/flows/llm_flows/context/_contents.py (retrieved 2026-11-17: load_memory returns a normal function result; the default contents processor includes prior function responses in later requests)"
  - "ADK documentation, \"Evaluation criteria\", github.com/google/adk-docs/blob/main/docs/evaluate/criteria.md (retrieved 2026-11-17: token_usage_v1 is an always-on informational criterion reporting tokens per invocation, with a breakdown that includes cached_tokens)"
  - "Gemini API documentation, \"Context caching\", ai.google.dev/gemini-api/docs/caching (retrieved 2026-11-17: implicit caching is enabled by default for Gemini 2.5 and newer models; minimum input tokens 2,048 for Gemini 2.5 Flash and Pro and 4,096 for several newer models; put large and common contents at the beginning of the prompt; cache hits reported in the response's usage data)"
  - "Google Cloud, \"Generative AI pricing\", cloud.google.com/vertex-ai/generative-ai/pricing, and Gemini API pricing, ai.google.dev/gemini-api/docs/pricing (retrieved 2026-11-17: Gemini 3.5 Flash input $1.50 and cached input $0.15 per million tokens; rates vary by model)"
touches:
  - agentic-ai/context-engineering
tags: [agents, context, adk, evaluation]
terms: [context window, context caching, history compaction, tool filter, preload_memory, load_memory, token_usage_v1]
related: [concept/agent-evalset, claim/adk-built-in-eval-criteria]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.8-context-engineering.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** Every model call an agent makes carries a context: instructions, tool declarations, conversation history, recalled memory, retrieved content and the new message. Each token costs latency and money, and material the step does not need competes for the model's attention. Treat the context as a budget per call: measure tokens by component on real long sessions (history is small early and dominant late), and cut the largest first.

**One cut per component.** Tool declarations: expose only the tools a step needs (`tool_filter` on an `McpToolset`, or sub-agents per task). History: compact it (`EventsCompactionConfig`: summarise older events, keep recent ones raw), and keep facts the agent needs again in session state, which compaction does not summarise. The threshold counts the whole prompt, so it must sit above the fixed part of the context. Memory: recall it on demand (`load_memory`) instead of before every call (`preload_memory`) when most turns do not need it; a load_memory result is an ordinary function response that stays in history (ADK's contents processor includes prior function responses) until compaction summarises it, while preloaded memory is inserted transiently per call, so measure multi-turn prompt totals rather than inferring the saving from call frequency. Retrieved content: rerank and pass fewer chunks. A larger context window removes none of these costs.

**Caching is separate.** Context caching reuses the processing of a repeated prompt prefix, which cuts its cost and latency; the cached tokens still count in the context window. Implicit caching is on by default for Gemini 2.5 and newer above a model-specific minimum, and needs the stable content at the start of the prompt. ADK's `ContextCacheConfig` is experimental.

**Verify.** Run the same evalset before and after each change, one change at a time. The quality criteria (`tool_trajectory_avg_score`, `response_match_score`) show what the change cost, and the always-on `token_usage_v1` shows what it saved.

**Canonical terms.** context window, context caching, history compaction, tool filter, evalset.
