---
id: claim/a2a-agent-card-discovery
type: claim
status: proposed
title: "An A2A agent card is published at /.well-known/agent-card.json and declares skills, endpoint and security schemes; Google Cloud's A2A hosting is in Preview"
scope: "A2A specification 1.0 and Google Cloud A2A support, as documented on 2026-11-17"
sources:
  - "A2A Project, \"A2A Protocol Specification\", version 1.0.0, a2a-protocol.org/v1.0.0/specification (retrieved 2026-11-17; card at https://{server_domain}/.well-known/agent-card.json; required fields name, description, supportedInterfaces, version, capabilities, defaultInputModes, defaultOutputModes, skills; each supportedInterfaces entry has url, protocolBinding and a required protocolVersion; securitySchemes define methods and securityRequirements say which are required; credentials obtained out of band and sent with every request; the server MUST authenticate every incoming request based on the provided credentials and its declared authentication requirements)"
  - "Google Cloud, \"Create an Agent2Agent agent\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/runtime/create-an-a2a-agent (retrieved 2026-11-17; Agent Runtime A2A agents; Preview)"
  - "Google Cloud, \"A2A agents on Cloud Run\", docs.cloud.google.com/run/docs/ai/a2a-agents (retrieved 2026-11-17; Preview)"
  - "Google Cloud, \"Agent Registry and the A2A protocol\", docs.cloud.google.com/agent-registry/a2a-protocol, and \"Automatic registration\", docs.cloud.google.com/agent-registry/automatic-registration (retrieved 2026-11-17; indexes A2A agent cards; automatic on Agent Runtime)"
  - "Google Cloud, \"Register and manage an A2A agent\", docs.cloud.google.com/gemini/enterprise/docs/register-and-manage-an-a2a-agent (retrieved 2026-11-17; card entered as JSON; A2A v0.3 streaming; Preview)"
touches:
  - agentic-ai/a2a-and-mcp
  - objective:agentic-ai/a2a-and-mcp#agent-card
  - item:agentic-ai/a2a-and-mcp#agent-card-contents
  - item:agentic-ai/a2a-and-mcp#find-the-card
  - item:agentic-ai/a2a-and-mcp#card-auth
tags: [agents, a2a, agent-registry, google-cloud]
terms: [agent card, securitySchemes, Agent Registry, Gemini Enterprise]
related: [concept/a2a-vs-mcp]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.6-a2a-and-mcp.md"
reviewed: 2026-11-17
review-by: 2027-02-17
---

**Claim.** Under A2A 1.0 an agent card is a JSON document published at `/.well-known/agent-card.json` that declares the agent's identity, endpoint, protocol binding and protocol version (`supportedInterfaces`), capabilities, skills, input and output modes and security schemes and requirements; it holds no secrets, and the server authenticates each request against its declared requirements (the card only declares them; the server must enforce them). Agent Runtime and Cloud Run document hosting A2A agents (Preview); Agent Registry indexes agent cards and registers Agent Runtime agents automatically; Gemini Enterprise registers A2A agents from their card and documents A2A v0.3 streaming.

**Limits.** Card field names differ between specification versions, and products lag the specification. Launch stages are as documented on the retrieval date.
