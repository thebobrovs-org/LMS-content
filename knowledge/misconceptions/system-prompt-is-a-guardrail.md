---
id: misconception/system-prompt-is-a-guardrail
type: misconception
status: proposed
title: "A stronger system prompt stops prompt injection"
scope: "Architects and engineers securing LLM agents"
sources:
  - "OWASP GenAI Security Project, LLM07:2025 System Prompt Leakage, github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM07_SystemPromptLeakage.md (retrieved 2026-11-17: \"the system prompt should not be considered a secret, nor should it be used as a security control\"; security controls should be enforced independently from the LLM)"
  - "OWASP GenAI Security Project, LLM01:2025 Prompt Injection, same repository, 2_0_vulns/LLM01_PromptInjection.md (retrieved 2026-11-17: \"it is unclear if there are fool-proof methods of prevention for prompt injection\")"
touches:
  - agentic-ai/agent-threat-model
  - objective:agentic-ai/agent-threat-model#indirect-injection
  - item:agentic-ai/agent-threat-model#system-prompt-fix
tags: [agents, security]
related: [concept/agent-threat-model]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/5.1-agent-threat-model.md"
reviewed: 2026-11-17
review-by: 2027-11-17
---

**The model.** "Tell the model in the system prompt never to follow instructions in documents, and injection is handled."

**How it shows.** A team answers an indirect-injection finding by adding a line to the system prompt, and closes it. The agent keeps its broad tools and access, with no screening and no approval step.

**The correcting example.** The system prompt guides the model; it does not enforce anything. A cleverly written instruction in a retrieved document can still persuade the model, and no fool-proof prevention is known. The limits that matter are enforced outside the model: the agent's identity holds only the access its task needs, a gateway admits only approved tools and destinations, screening such as Model Armor inspects content, and a person approves high-risk actions. Then a fooled model can still do only small things.
