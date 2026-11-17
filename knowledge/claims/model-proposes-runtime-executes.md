---
id: claim/model-proposes-runtime-executes
type: claim
status: proposed
title: "In function calling the model proposes a call; the application or runtime executes it"
scope: "Function tools in the Gemini API and ADK. For built-in tools a provider's service may execute the call, still outside the model"
sources:
  - "Google, Gemini API documentation, \"Function calling\", ai.google.dev/gemini-api/docs/function-calling (retrieved 2026-11-17; \"The model doesn't execute the function itself. Extract the name and args and execute in your application.\")"
  - "ADK documentation, \"Runtime event loop\", github.com/google/adk-docs/blob/main/docs/runtime/event-loop.md (retrieved 2026-11-17; the Runner orchestrates agents, tools and callbacks; tools are developer-defined logic, the LLM reasons about which to use)"
  - "ADK documentation, \"Gemini API Google Search tool for ADK\" and \"Gemini API Code Execution tool for ADK\", github.com/google/adk-docs/blob/main/docs/integrations/google-search.md and .../code-execution.md (retrieved 2026-11-17; built-in tools are Gemini API features, run by the Gemini service rather than your code)"
touches:
  - agentic-ai/the-agent-loop
  - objective:agentic-ai/the-agent-loop#who-executes
  - item:agentic-ai/the-agent-loop#who-executes-card
  - item:agentic-ai/the-agent-loop#model-calls-api
  - agentic-ai/what-is-an-agent
  - item:agentic-ai/what-is-an-agent#who-runs-the-tool
tags: [agents, tools]
terms: [function call, runtime, tool execution]
related: [concept/function-calling]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.1-the-agent-loop.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** A model with function calling never runs a tool. It returns a structured function call (a declared name and arguments) and stops; the application, or an agent runtime such as ADK's Runner, executes the function and sends the result back as the next input.

**Limits.** Built-in tools (for example Google Search or code execution) are Gemini API features run by the Gemini service rather than your code, but still outside the model's own reasoning. The model opens no network connections and holds no credentials; whoever executes the call does, which is why tool permissions belong to the runtime's identity (S5).
