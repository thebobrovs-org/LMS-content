---
id: claim/agent-runtime-services-and-name
type: claim
status: proposed
title: "Agent Runtime (formerly Agent Engine) offers managed agent services, and Memory Bank works without deploying the agent there"
scope: "Google Cloud Agent Runtime as documented in November 2026. Product names and the list of services change; Preview flags apply to some features (the scaling resource controls are Preview)"
sources:
  - "ADK documentation, \"Deploy to Agent Runtime\", github.com/google/adk-docs/blob/main/docs/deploy/agent-runtime/index.md (retrieved 2026-11-17: Agent Runtime is a set of modular services that help developers scale and govern agents in production; it is a paid service with a no-cost access tier; its documentation links still live under /agent-engine/ paths)"
  - "ADK documentation, \"Deploy to Agent Runtime\" (standard path), github.com/google/adk-docs/blob/main/docs/deploy/agent-runtime/deploy.md (retrieved 2026-11-17: the deploy command is adk deploy agent_engine)"
  - "ADK documentation, \"Memory\", github.com/google/adk-docs/blob/main/docs/sessions/memory.md (retrieved 2026-11-17: Memory Bank is a fully managed service; you need an Agent Runtime instance but do not need to deploy your agent to Agent Runtime to use Memory Bank)"
  - "Google Cloud, \"Deploy an agent\", docs.cloud.google.com/gemini-enterprise-agent-platform/scale/runtime/deploy-an-agent (last updated 2026-11-12: min_instances, max_instances, container_concurrency and resource_limits on a deployed agent, marked Preview; read through a fetch summary: min_instances 0 to 75, default 1; max_instances 1 to 1000, default 100; container_concurrency default 9; resources 4 CPU and 4Gi by default; the lesson relies on none of these numbers)"
  - "Google Cloud, \"Agent Runtime\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime (last updated 2026-11-12: \"Because the name of Agent Runtime changed over time\", the API resource is still named ReasoningEngine)"
  - "planning/gcp-agentic-architect/path.md (approved 2026-11-17: Agent Engine became Agent Runtime; the former name itself is inferred from the agent-engine documentation paths, the agentengine:// URI scheme and the adk deploy agent_engine command, and wants a Google page that states it)"
touches:
  - agentic-ai/deploying-agents
tags: [agents, deployment, agent-runtime]
terms: [Agent Runtime, Agent Engine, Sessions, Memory Bank]
related: [concept/agent-runtime-choice]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.3-deploying-agents.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** Agent Runtime, formerly Agent Engine, is Google Cloud's managed runtime for agents: a set of modular services to deploy, scale and govern agents, including managed Sessions and Memory Bank. ADK deploys to it with `adk deploy agent_engine` (the command keeps the old name). Memory Bank needs an Agent Runtime instance, but the agent itself need not be deployed to Agent Runtime to use it. A deployed agent has minimum and maximum instances, container concurrency and resource limits, which were Preview on 2026-11-12.

**Limits.** The lesson does not state the exact defaults or ranges of the scaling settings: they were read through a fetch summary, not verbatim, and are Preview. Quiz none of them until a reviewer confirms them on the page.
