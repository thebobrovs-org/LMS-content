---
id: concept/agent-runtime-choice
type: concept
status: proposed
title: "Agent Runtime, Cloud Run and GKE are substitutes: choose by the control you need and the operations you will own"
scope: "Choosing where to run an ADK (or other framework) agent on Google Cloud. The ordering by control and operating burden is this path's teaching framing, built on ADK's deployment guidance"
sources:
  - "ADK documentation, \"Deploying your agent\", github.com/google/adk-docs/blob/main/docs/deploy/index.md (retrieved 2026-11-17: Agent Runtime is a fully managed auto-scaling service designed for deploying, managing and scaling agents; Cloud Run runs the agent as a container-based application; GKE is a good option if you need more control over the deployment as well as for running open models)"
  - "ADK documentation, \"Deploy to Cloud Run\", github.com/google/adk-docs/blob/main/docs/deploy/cloud-run.md (retrieved 2026-11-17: session, artifact and memory service URIs, including agentengine:// for managed sessions)"
touches:
  - agentic-ai/deploying-agents
tags: [agents, deployment]
terms: [Agent Runtime, Cloud Run, GKE, substitute, operating burden]
related: [claim/agent-runtime-services-and-name, claim/adk-cloud-run-in-memory-sessions]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.3-deploying-agents.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** The same ADK agent can run on Agent Runtime, Cloud Run or GKE with little code change, so the three are substitutes. They differ in how much you control and how much you operate: Agent Runtime is managed and built for agents (managed sessions, Memory Bank, evaluation, observability, identity) and leaves you the least to run; Cloud Run gives you a serverless container you control, with no cluster; GKE gives you Kubernetes, with control of nodes, accelerators and networking, and the most to run. Choose the leftmost option that meets the requirements, and move right only when one forces you to (an existing platform, node-level compliance, self-served open models on your own GPUs).

**Hybrid.** State is separable from compute: an agent on Cloud Run or GKE can use Agent Runtime's managed Sessions and Memory Bank.

**Cost.** Total cost includes model tokens (often the largest running cost, since every loop turn sends tokens, though warm idle compute can dominate for a low-traffic agent), instance settings, billing mode and the engineering time to operate the platform, so no runtime is always cheapest.

**Canonical terms.** Agent Runtime, Cloud Run, GKE, min instances, max instances, concurrency, cold start.
