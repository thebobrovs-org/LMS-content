---
id: concept/layered-agent-guardrails
type: concept
status: proposed
title: "Agent guardrails are layers enforced outside the model: screening, data protection, confirmation and user-scoped identity"
scope: "Tool-using agents on Google Cloud with Model Armor, Sensitive Data Protection and ADK tool confirmation, as documented on 2026-11-17; the threat-to-layer table is this path's teaching frame"
sources:
  - "Google Cloud, Model Armor overview, docs.cloud.google.com/model-armor/overview (retrieved 2026-11-17: screens prompts and responses; prompt injection and jailbreak, responsible AI, malicious URL and Sensitive Data Protection filters; templates as sets of filters and confidence thresholds; inspect only logs to Cloud Logging, inspect and block also stops the content; basic SDP inspects credit card, US SSN, financial account, US ITIN, Google Cloud credentials and API key, supports no templates and is mainly for the US; advanced SDP uses templates and supports de-identification)"
  - "Google Cloud, Configure floor settings, https://docs.cloud.google.com/model-armor/configure-floor-settings (retrieved 2026-11-17: new or updated templates must conform to the applicable floor; local settings take precedence on conflict; Sensitive Data Protection does not validate template conformance)"
  - "Google, Agent Development Kit documentation, Get action confirmation for ADK Tools, github.com/google/adk-docs/blob/main/docs/tools-custom/confirmation.md (retrieved 2026-11-17: require_confirmation as a boolean or a function of the tool's input; tool_context.request_confirmation with a hint and payload; the adk_request_confirmation event; DatabaseSessionService and VertexAiSessionService not supported)"
  - "OWASP GenAI Security Project, LLM06:2025 Excessive Agency, github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM06_ExcessiveAgency.md (retrieved 2026-11-17: execute extensions in the user's context with minimum privileges; require user approval for high-impact actions)"
touches:
  - agentic-ai/guardrails-model-armor-hitl
tags: [agents, security, guardrails]
terms: [model armor, floor setting, sensitive data protection, human in the loop]
related: [concept/agent-threat-model, misconception/system-prompt-is-a-guardrail, concept/oauth-2lo-vs-3lo, claim/model-armor-gateway-integration]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/5.5-guardrails-model-armor-hitl.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**Concept.** Each agent threat gets its own guardrail, enforced outside the model. Prompt injection (in a message or a tool's output) and harmful replies: **Model Armor** screening on input and output. Sensitive data leaking: **Sensitive Data Protection** inside Model Armor (basic for a fixed, mainly US set of infoTypes; advanced, with templates, for other infoTypes and de-identification). Irreversible actions: **human confirmation** before the tool runs (ADK `require_confirmation`, always or by a threshold function). Retrieval returning more than the user may see: **act with the user's identity** (for example a three-legged OAuth token), so the data source applies the user's permissions.

**Model Armor settings.** Templates decide how to screen; new and updated templates must meet the applicable floor. More local settings take precedence when floors conflict, so an organisation-level setting is not an immutable combined baseline. The documented template-conformance checks do not cover Sensitive Data Protection. Roll out with inspect only, then inspect and block.

**Why layers.** A system prompt line is not a control, and any single filter can miss, so the layers back each other up.
