---
id: concept/agent-threat-model
type: concept
status: proposed
title: "Agent threats and the four defence layers that answer them"
scope: "Tool-using LLM agents; the five-threat grouping and the four layers (identity, access control, runtime gateway, guardrails) are this path's teaching frame, drawn from the OWASP Top 10 for LLM applications (2025) and Google Cloud's agent governance products"
sources:
  - "OWASP GenAI Security Project, LLM01:2025 Prompt Injection, github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM01_PromptInjection.md (retrieved 2026-11-17: direct and indirect injection; no fool-proof prevention known; least privilege, human approval for high-risk actions and segregating external content as mitigations)"
  - "OWASP GenAI Security Project, LLM06:2025 Excessive Agency, same repository, 2_0_vulns/LLM06_ExcessiveAgency.md (retrieved 2026-11-17: excessive functionality, permissions and autonomy)"
  - "Google Cloud, Agent Identity overview, docs.cloud.google.com/iam/docs/agent-identity-overview (retrieved 2026-11-17: a dedicated principal per agent; permissions granted directly to its identifier; audit logs record the agent and the delegating user)"
  - "OWASP GenAI Security Project, LLM02:2025 Sensitive Information Disclosure and LLM03:2025 Supply Chain, same repository as LLM01 (retrieved 2026-11-17: sensitive data exposed through output; third-party components as a risk)"
  - "Google Cloud, Model Armor overview, docs.cloud.google.com/model-armor/overview (retrieved 2026-11-17: screens prompts and responses, including prompt injection and jailbreak detection and Sensitive Data Protection)"
touches:
  - agentic-ai/agent-threat-model
tags: [agents, security]
terms: [prompt injection, indirect prompt injection, excessive agency]
related: [concept/agent, misconception/system-prompt-is-a-guardrail]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/5.1-agent-threat-model.md"
reviewed: 2026-11-17
review-by: 2027-11-17
---

**Concept.** An agent acts, so a successful attack on it becomes an action taken with the agent's access. This path groups agent threats into five: **prompt injection** in two forms, direct (written by the person using the agent) and **indirect** (carried by content the agent reads: pages, documents, emails, tool output); **excessive agency** (more tools, permissions or autonomy than the task needs); **data leakage** through retrieval or output; **unsafe irreversible actions** taken without a check; and **unvetted tools and agents** no one reviewed.

**Four layers.** **Identity** (who is acting: the agent's own principal, so access can be granted to it alone and its calls audited), **access control** (what that identity may reach: least privilege), the **runtime gateway** (whether this traffic is allowed: a policy point on agent traffic, with an approved registry of tools and agents) and **guardrails** (whether content or an action is safe: screening such as Model Armor, and human approval for high-risk actions).

**Defence in depth.** No fool-proof prevention for prompt injection is known, so screening is backed by least privilege, and least privilege by human approval. Untrusted content is treated as data: nothing in it should change what the agent may do.
