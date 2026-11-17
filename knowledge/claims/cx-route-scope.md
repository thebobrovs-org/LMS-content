---
id: claim/cx-route-scope
type: claim
status: proposed
title: "In a Dialogflow CX flow, flow-level condition-only routes are in scope only on the start page; flow-level intent routes are in scope on every page"
scope: "Dialogflow CX state handlers, which CX Agent Studio imports as flow-based agents, as documented on 2026-11-17"
sources:
  - "Google Cloud, Dialogflow CX, \"State handlers\", docs.cloud.google.com/dialogflow/cx/docs/concept/handler (updated 2026-11-10, retrieved 2026-11-17; flow routes: \"If the current page is the flow start page, they are in scope\"; \"If the current page is not the flow start page, they are only in scope if they have an intent requirement\"; evaluation phases for intent routes, condition-only routes and event handlers; intents and events consumed, conditions not; a handler with a transition target ends evaluation)"
  - "Google Cloud, \"Flow-based agents\", docs.cloud.google.com/gemini-enterprise-cx/cx-agent-studio/flow (retrieved 2026-11-17; CX Agent Studio imports Dialogflow CX flows)"
touches:
  - agentic-ai/cx-agent-studio-flows
  - objective:agentic-ai/cx-agent-studio-flows#predict-route
  - item:agentic-ai/cx-agent-studio-flows#scope-non-start-page
  - item:agentic-ai/cx-agent-studio-flows#evaluation-phases
  - item:agentic-ai/cx-agent-studio-flows#balance-route-missing
  - item:agentic-ai/cx-agent-studio-flows#intent-before-condition
  - item:agentic-ai/cx-agent-studio-flows#second-no-match
  - checkpoint:cx-route-resolver/observe-route-scope
tags: [google-cloud, customer-experience, dialogflow]
terms: [transition route, event handler, start page, route scope]
related: [concept/cx-flow-state-machine]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/1.2-cx-agent-studio-flows.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** The current page's routes and event handlers, and the flow's event handlers, are always in scope. The flow's routes are all in scope on the start page, but on any other page only those with an intent requirement are. After a user turn, routes with an intent are evaluated (page, then flow), then routes with only a condition (page, then flow on the start page), then event handlers (parameter, page, flow). A handler with a transition target ends evaluation; intents and events are consumed by the first matching handler, conditions are not.

**Limits.** The plan for this topic phrased the rule as "the current page's routes, then the flow's start-page routes"; the documented rule differs: flow-level intent routes stay in scope on every page, and only condition-only flow routes are limited to the start page. Route groups follow their owner's position in the order. The sim models one flow without route groups or form parameters.
