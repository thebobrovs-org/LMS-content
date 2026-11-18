---
id: claim/content-screening-vs-tool-intent
type: claim
status: proposed
title: "A content finding and a tool-intent verdict answer different questions"
scope: "Model Armor and Agent Gateway semantic governance as documented on 2026-11-17; the B10 outcomes are scripted examples, not measured detector results"
sources:
  - "Google Cloud, Model Armor overview, https://docs.cloud.google.com/model-armor/overview (retrieved 2026-11-17: templates select filters and thresholds; basic SDP inspects card numbers; inspect-only needs logging and does not block, while inspect-and-block relies on the calling integration to enforce the verdict; single-turn inspection does not maintain conversation history)"
  - "Google Cloud, Semantic governance policies overview, https://docs.cloud.google.com/gemini-enterprise-agent-platform/govern/policies/semantic-governance-overview (retrieved 2026-11-17: compares proposed tool calls with the user prompt, chat history and natural-language constraints; Preview, probabilistic verdicts may be wrong; streamed model responses are not supported)"
touches:
  - agentic-ai/guardrails-model-armor-hitl
  - objective:agentic-ai/guardrails-model-armor-hitl#semantic-governance
  - sim:guardrail-visibility
  - checkpoint:guardrail-visibility/observe-guardrail-blind-spot
tags: [agents, guardrails, security]
related: [concept/layered-agent-guardrails, claim/model-armor-gateway-integration]
provenance:
  origin: authoring
  by: agent:codex
  from: "LMS-content#206"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** Absence of a Model Armor content finding does not establish that a proposed tool call matches the user's intent. Semantic governance evaluates that relationship using the request, history and policies before the call executes.

**Example.** B10 holds an ordinary-looking `send_email` call fixed and changes the user request from summarising to sending. Its illustrative policy allows sending only when the user requested that send. The first fixture is denied and the second allowed, without a content finding in either. This teaches which information the checks use, not a guarantee that a real detector returns either verdict.

**Limits.** Semantic governance is an LLM-based Preview feature and can make mistakes. B10 assumes a supported non-streaming response, configured policies and enforcement. Content-only fixtures contain no proposed tool call, so the semantic panel reports that no call is evaluated. A logged detection in inspect-only mode is not a block; the simulation assumes logging is enabled.
