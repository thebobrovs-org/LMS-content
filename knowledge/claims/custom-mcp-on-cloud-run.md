---
id: claim/custom-mcp-on-cloud-run
type: claim
status: proposed
title: "Cloud Run hosts custom MCP servers over streamable HTTP, not stdio; Google remote MCP servers are registered in Agent Registry automatically"
scope: "Custom MCP server hosting and Agent Registry, as documented on 2026-11-17"
sources:
  - "Google Cloud, \"Host MCP servers on Cloud Run\", docs.cloud.google.com/run/docs/host-mcp-servers (retrieved 2026-11-17; \"Cloud Run supports hosting MCP servers with streamable HTTP transport, but not MCP servers with stdio transport\"; requests are IAM-authorised by default)"
  - "Google Cloud, \"Register MCP servers\", docs.cloud.google.com/agent-registry/register-mcp-servers (retrieved 2026-11-17; Google and Google Cloud remote MCP servers are automatically registered; custom Cloud Run services register automatically when deployed with --functional-type=mcp-server, and GKE workloads with an equivalent label; otherwise gcloud agent-registry services create)"
  - "Google Cloud, \"Agent Registry overview\", docs.cloud.google.com/agent-registry/overview (retrieved 2026-11-17; catalogues AI agents, MCP servers and tools, endpoints and skills; access policies bind agent principals to registered resources)"
touches:
  - agentic-ai/mcp-tools-and-integrations
  - objective:agentic-ai/mcp-tools-and-integrations#choose-integration
  - objective:agentic-ai/mcp-tools-and-integrations#register-tools
  - item:agentic-ai/mcp-tools-and-integrations#stdio-on-cloud-run
  - item:agentic-ai/mcp-tools-and-integrations#auto-registered
  - item:agentic-ai/mcp-tools-and-integrations#registry-purpose
  - item:agentic-ai/mcp-tools-and-integrations#registry-card
tags: [agents, mcp, cloud-run, agent-registry]
terms: [streamable HTTP, stdio, Agent Registry]
related: [concept/google-cloud-mcp-servers]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.5-mcp-tools-and-integrations.md"
reviewed: 2026-11-17
review-by: 2027-02-17
---

**Claim.** Cloud Run can host a custom MCP server that uses the streamable HTTP transport, not one that uses stdio, and requires IAM-authorised requests by default. In Agent Registry, Google and Google Cloud remote MCP servers are registered automatically; a custom server is registered automatically in some deployments (a Cloud Run service deployed with --functional-type=mcp-server, or a labelled GKE workload) and otherwise registered manually.

**Limits.** The plan asked for a record that Agent Runtime cannot host custom MCP servers. No primary page states that, so this record does not claim it: Google's ADK deployment guide shows the agent on Agent Runtime and the MCP server as a separate Cloud Run service, and also allows stdio servers bundled inside the agent's container. Agent Registry features are partly in Preview.
