---
id: concept/cx-flow-state-machine
type: concept
status: proposed
title: "Flows in CX Agent Studio: Dialogflow CX state machines behind an instruction-based steering agent"
scope: "CX Agent Studio and Dialogflow CX as documented on 2026-11-17"
sources:
  - "Google Cloud, \"Flow-based agents\", docs.cloud.google.com/gemini-enterprise-cx/cx-agent-studio/flow (retrieved 2026-11-17; import a Dialogflow CX flow under an agent; input mapping into session parameters, output mapping back to agent variables; flows as black boxes; use flows for highly deterministic logic, callbacks for canned responses, the model for intent classification; agents as the steering layer)"
  - "Google Cloud, Dialogflow CX, \"Pages\", docs.cloud.google.com/dialogflow/cx/docs/concept/page (retrieved 2026-11-17; a session is a state machine whose states are pages; exactly one current page; every flow has a start page)"
  - "Google Cloud, Dialogflow CX, \"State handlers\", docs.cloud.google.com/dialogflow/cx/docs/concept/handler (updated 2026-11-10, retrieved 2026-11-17; routes with intent and/or condition requirements; event handlers; every flow has no-match and no-input handlers that cannot be deleted)"
  - "Google Cloud, \"Instructions\", docs.cloud.google.com/gemini-enterprise-cx/cx-agent-studio/instruction (retrieved 2026-11-17; XML structure role, persona, primary_goal, constraints, taskflow, subtask, step, trigger, action, examples; few-shot guidance)"
touches:
  - agentic-ai/cx-agent-studio-flows
  - objective:agentic-ai/cx-agent-studio-flows#instruction-vs-flow
  - objective:agentic-ai/cx-agent-studio-flows#write-instructions
  - item:agentic-ai/cx-agent-studio-flows#route-vs-handler
  - item:agentic-ai/cx-agent-studio-flows#flow-when
  - item:agentic-ai/cx-agent-studio-flows#few-shot-when
  - item:agentic-ai/cx-agent-studio-flows#card-verification
  - item:agentic-ai/cx-agent-studio-flows#intent-classification
  - item:agentic-ai/cx-agent-studio-flows#few-shot-first
  - item:agentic-ai/cx-agent-studio-flows#taskflow-placement
tags: [google-cloud, customer-experience, dialogflow, prompting]
terms: [flow, page, transition route, event handler, few-shot example, taskflow]
related: [claim/cx-route-scope, concept/agent-vs-workflow]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/1.2-cx-agent-studio-flows.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** CX Agent Studio steers customer conversations with instruction-based agents, which read their instructions each turn and decide what to say and which tools or agents to use. For a procedure that must run the same way every time, an agent hands the conversation to a flow: a Dialogflow CX flow imported into CX Agent Studio, passed values as session parameters and returning output parameters when it reaches END_SESSION, and treated as a black box. Inside, the flow is a state machine of pages, one current at a time, moved by transition routes (an intent, a condition or both) and answered by event handlers (no-match, no-input and others).

**Instructions.** Google suggests an XML structure, which can help the model follow instructions (role, persona with primary goal, constraints, a taskflow of subtasks whose steps pair a trigger with an action, and examples). Few-shot examples are added only when clear instructions fail, used sparingly, and show a pattern rather than enumerate cases.

**Canonical terms.** flow-based agent, flow, page, start page, transition route, event handler, session parameter, taskflow, few-shot example.
