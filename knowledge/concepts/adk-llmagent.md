---
id: concept/adk-llmagent
type: concept
status: proposed
title: "An ADK LlmAgent: identity, model, instruction, tools, sub-agents and callbacks"
scope: "ADK LlmAgent (alias Agent) as documented on 2026-11-17, Python examples; other ADK languages expose the same parts"
sources:
  - "ADK documentation, \"Simple agents with LlmAgent\", github.com/google/adk-docs/blob/main/docs/agents/llm-agents.md (retrieved 2026-11-17; name required; description used by other agents for routing; model, instruction, tools)"
  - "ADK documentation, \"Function tools\", github.com/google/adk-docs/blob/main/docs/tools-custom/function-tools.md (retrieved 2026-11-17; a function in tools is wrapped as a FunctionTool; schema from name, docstring, parameters, type hints)"
  - "ADK documentation, \"Callbacks\" and \"Types of callbacks\", github.com/google/adk-docs/blob/main/docs/callbacks/index.md and types-of-callbacks.md (retrieved 2026-11-17; before/after agent, model and tool; return-value effects; in Python only None lets the tool run)"
  - "ADK documentation, \"Limitations for ADK tools\", github.com/google/adk-docs/blob/main/docs/tools/limitations.md (retrieved 2026-11-17; Code Execution, Google Search and Agent Search can only be used by themselves in one agent; built-in tools cannot be used within a sub-agent; workarounds AgentTool and bypass_multi_tools_limit)"
  - "ADK documentation, \"Python quickstart\", github.com/google/adk-docs/blob/main/docs/get-started/python.md (retrieved 2026-11-17; agent.py with root_agent; adk web)"
touches:
  - agentic-ai/adk-agents-and-tools
  - objective:agentic-ai/adk-agents-and-tools#build-llmagent
  - objective:agentic-ai/adk-agents-and-tools#use-callbacks
  - item:agentic-ai/adk-agents-and-tools#tool-schema-source
  - item:agentic-ai/adk-agents-and-tools#misrouted-specialist
  - item:agentic-ai/adk-agents-and-tools#callback-types
  - item:agentic-ai/adk-agents-and-tools#argument-check-placement
  - item:agentic-ai/adk-agents-and-tools#after-model-redaction
tags: [agents, adk]
terms: [ADK, LlmAgent, Agent, callback, before_tool_callback, function tool, built-in tool, adk web]
related: [concept/function-calling, concept/subagent-vs-agenttool]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.2-adk-agents-and-tools.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** An ADK `LlmAgent` (alias `Agent`) is configured by a required `name`, a `description` other agents read when routing, a `model`, an `instruction`, a list of `tools` and optionally `sub_agents` and callbacks. A Python function placed in `tools` is wrapped as a function tool whose declaration comes from the function's name, docstring, parameters and type hints. Built-in tools (Google Search, code execution) are Gemini API features; in ADK some of them (Code Execution, Google Search, Agent Search) can only be used alone in one agent, and built-in tools cannot be used inside a sub-agent; the documented workaround wraps each in its own agent attached as an `AgentTool` (ADK Python can also bypass the limit for the search tools with `bypass_multi_tools_limit=True`).

**Callbacks.** Three pairs run at fixed points: before/after the agent, before/after each model call, before/after each tool call. Returning `None` lets the step proceed. Returning a value from a before-callback skips the step and uses the value (content, an `LlmResponse`, or a tool-result dictionary); returning a value from an after-model or after-tool callback replaces the output, and from an after-agent callback appends content. In Python only `None` lets a tool run: an empty dictionary counts as a result. Callbacks are deterministic code, so they are where checks that must always hold belong; the instruction only guides the model.

**Canonical terms.** LlmAgent, instruction, description, function tool, built-in tool, before_tool_callback, after_model_callback, root_agent, adk web.
