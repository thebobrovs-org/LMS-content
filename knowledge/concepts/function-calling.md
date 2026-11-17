---
id: concept/function-calling
type: concept
status: proposed
title: "Function calling: the model proposes a structured call, the application runs it"
scope: "Tool use by LLM agents through function calling, as the Gemini API and ADK describe it"
sources:
  - "Google, Gemini API documentation, \"Function calling\", ai.google.dev/gemini-api/docs/function-calling (retrieved 2026-11-17; declaration fields name, description and parameters; the flow: declare, call the model, execute in your application, send the result back; repeatable over multiple turns; parallel and compositional calls)"
  - "ADK documentation, \"Custom tools\", section \"How agents use tools\" and \"Defining effective tool functions\", github.com/google/adk-docs/blob/main/docs/tools-custom/index.md (retrieved 2026-11-17; the LLM selects a tool from the docstrings; the name, parameters, type hints and docstring are what the model uses to choose and call it)"
  - "ADK documentation, \"Function tools\", github.com/google/adk-docs/blob/main/docs/tools-custom/function-tools.md (retrieved 2026-11-17; ADK inspects the function's name, docstring, parameters and type hints to generate the schema the LLM sees)"
  - "Yao et al. (2022), \"ReAct: Synergizing Reasoning and Acting in Language Models\", arXiv:2210.03629 (interleaving reasoning traces and actions)"
touches:
  - agentic-ai/the-agent-loop
  - objective:agentic-ai/the-agent-loop#trace-loop
  - item:agentic-ai/the-agent-loop#declaration-contents
  - item:agentic-ai/the-agent-loop#vague-tool-names
  - sim:agent-loop-stepper
  - agentic-ai/what-is-an-agent
  - item:agentic-ai/what-is-an-agent#who-runs-the-tool
tags: [agents, tools]
terms: [function calling, function declaration, tool call, ReAct, docstring]
related: [concept/agent, claim/model-proposes-runtime-executes]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.1-the-agent-loop.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** A **function declaration** tells the model a tool exists: a name, a description and a parameter schema (types, which parameters are required). On each call the model reads the instruction, the declarations and the conversation so far, and either answers in text or returns a **function call**: the name of one declared function and the arguments to pass. The application (in ADK, the framework) executes the function and appends the result to the conversation, and the model is called again with it. Repeating this until the model answers in text is the agent loop. The model can also ask for several calls in one turn (parallel) or chain calls across turns (compositional).

**Why descriptions matter.** The declaration is the only thing the model knows about a tool, so its name and description work as a prompt. ADK builds the declaration from a Python function's name, docstring, parameters and type hints; a generic name (`run`, `fetch`) or an empty docstring leaves the model guessing which tool fits.

**ReAct.** The reason-then-act pattern (Yao et al., 2022) interleaves reasoning steps and actions, each action's observation informing the next step. Function-calling agents follow the same rhythm with structured calls.

**Canonical terms.** function calling, function declaration, function call, function response, tool call, ReAct.
