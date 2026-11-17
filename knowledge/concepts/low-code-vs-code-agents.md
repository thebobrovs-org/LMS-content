---
id: concept/low-code-vs-code-agents
type: concept
status: proposed
title: "Low-code, code or hybrid: when each fits and how they join"
scope: "Google Cloud agent building as documented on 2026-11-17: Workflow Builder and CX Agent Studio (low-code) against the Agent Development Kit (code)"
sources:
  - "Google Cloud, Workflow Builder overview, docs.cloud.google.com/gemini/enterprise/docs/workflow-builder (retrieved 2026-11-17; chat agents and workflows, steps, human approvals, connectors and tools)"
  - "Google Cloud, Workflow Builder, \"Connect MCP servers\" and \"Add an existing agent step\", docs.cloud.google.com/gemini/enterprise/docs/workflow-builder (retrieved 2026-11-17; MCP steps and MCP tools on a Gemini agent step; existing-agent step runs a published (registered) ADK or A2A agent shared with you)"
  - "Google Cloud, Workflow Builder, \"Simulate a workflow\", docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/simulate-workflows (retrieved 2026-11-17; testing is manual simulation in the Preview tab)"
  - "Google Cloud, Workflow Builder quotas and limits, docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/quotas-and-limits (updated 2026-11-10, retrieved 2026-11-17; sub-agent depth 1; sub-agents run sequentially, not in parallel)"
  - "Google Cloud, CX Agent Studio documentation, docs.cloud.google.com/gemini-enterprise-cx/cx-agent-studio (retrieved 2026-11-17; flows for deterministic logic; MCP tools over streamable HTTP; Cloud Run authentication by service agent ID token; A2A Protocol tool delegates to remote agents; evaluation test cases, runnable through the v1beta runEvaluation API)"
  - "Google Cloud, Gemini Enterprise, \"Register and manage ADK agents hosted on Agent Runtime\" and \"Register and manage A2A agents\", docs.cloud.google.com/gemini/enterprise/docs (retrieved 2026-11-17)"
  - "Google, Agent Development Kit documentation, adk.dev (retrieved 2026-11-17; multi-agent systems including parallel agents, evaluation, deployment to Agent Runtime, Cloud Run or GKE)"
touches:
  - agentic-ai/low-code-or-code
  - objective:agentic-ai/low-code-or-code#choose-build-approach
  - objective:agentic-ai/low-code-or-code#hybrid-design
  - objective:agentic-ai/low-code-or-code#migration-signals
  - item:agentic-ai/low-code-or-code#default-low-code
  - item:agentic-ai/low-code-or-code#migration-signals-list
  - item:agentic-ai/low-code-or-code#two-registration-paths
  - item:agentic-ai/low-code-or-code#hybrid-normal
  - item:agentic-ai/low-code-or-code#hr-approval-flow
  - item:agentic-ai/low-code-or-code#nested-research
  - item:agentic-ai/low-code-or-code#forecast-hybrid
  - item:agentic-ai/low-code-or-code#contact-centre-tools
  - item:agentic-ai/low-code-or-code#signal-to-migrate
  - objective:agentic-ai/low-code-or-code#migration-risks
  - item:agentic-ai/low-code-or-code#what-migrations-break
  - item:agentic-ai/low-code-or-code#eval-before-switch
tags: [agents, architecture, low-code]
terms: [hybrid agent, Workflow Builder, CX Agent Studio, ADK, existing-agent step, MCP step]
related: [concept/agent-runtime-choice, concept/agent-vs-workflow]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/0.4-low-code-or-code.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** Start low-code (Workflow Builder, CX Agent Studio) when the platform covers the need: its steps, connectors and tools do the job, the process owners can maintain it, and the platform's sharing and governance are enough. Move to code (ADK) for control the platform cannot give: logic its steps can't express, orchestration beyond its limits (Workflow Builder runs sub-agents one at a time and one level deep), evaluation of logic you own that must run in CI (Workflow Builder testing is manual simulation with no documented API; CX Agent Studio test cases can run through a beta runEvaluation API, but they test the CX agent, not your code), control of deployment, scaling or networking, and integrations no connector or tool covers.

**Hybrids.** Google documents several joins; the main ones: A low-code agent calls code-built tools (Workflow Builder MCP steps or MCP tools on a Gemini agent step; CX Agent Studio OpenAPI and MCP tools, MCP over streamable HTTP). A low-code agent calls a code-built agent: Workflow Builder's existing-agent step runs an ADK or A2A agent published (registered) in Gemini Enterprise and shared with you, and CX Agent Studio delegates to a remote ADK or A2A agent through an A2A tool. A code-built agent appears in Gemini Enterprise by registering an ADK agent deployed to Agent Runtime, or an A2A agent by its agent card (preview).

**What migrations break.** Evaluation (low-code test cases don't run against the code agent), identity (whose permissions the agent uses, OAuth to act for the user) and governance settings that stop applying (see claim/registered-agents-governance-gaps). Decide where each lives for every part at the start.

**Canonical terms.** hybrid agent, Workflow Builder, CX Agent Studio, ADK, existing-agent step, MCP step, custom agent via Agent Runtime.
