---
id: concept/google-cloud-mcp-servers
type: concept
status: proposed
title: "Three MCP integration routes: Google Cloud MCP servers, MCP Toolbox for Databases, custom MCP servers"
scope: "Giving agents tools through MCP on Google Cloud, as documented in November 2026"
sources:
  - "Google Cloud, \"Google Cloud MCP servers overview\", docs.cloud.google.com/mcp/overview (retrieved 2026-11-17; remote MCP servers run on the service's infrastructure and offer an HTTP endpoint)"
  - "Google Cloud, \"Supported products\", docs.cloud.google.com/mcp/supported-products (retrieved 2026-11-17; BigQuery, Cloud SQL, Spanner, GKE, Cloud Storage and others, with endpoints such as bigquery.googleapis.com/mcp)"
  - "Google Cloud, \"Access control\", docs.cloud.google.com/mcp/access-control (retrieved 2026-11-17; the tool caller needs the MCP Tool User role, roles/mcp.toolUser, plus the product's roles)"
  - "Google Cloud, \"Prevent read-write tool use\", docs.cloud.google.com/mcp/prevent-read-write-tool-use (retrieved 2026-11-17; IAM deny policies restrict MCP tools to read-only actions; not for non-Google Cloud MCP servers)"
  - "Google, MCP Toolbox for Databases, github.com/googleapis/mcp-toolbox README (retrieved 2026-11-17; open-source MCP server for databases; tool configuration with a fixed statement and parameters)"
touches:
  - agentic-ai/mcp-tools-and-integrations
  - objective:agentic-ai/mcp-tools-and-integrations#choose-integration
  - item:agentic-ai/mcp-tools-and-integrations#three-integration-routes
  - item:agentic-ai/mcp-tools-and-integrations#route-order-inline
  - item:agentic-ai/mcp-tools-and-integrations#bigquery-route
  - item:agentic-ai/mcp-tools-and-integrations#internal-api-route
  - item:agentic-ai/mcp-tools-and-integrations#tool-filter
tags: [agents, mcp, tools, google-cloud]
terms: [MCP, Google Cloud MCP servers, MCP Toolbox for Databases, McpToolset]
related: [claim/custom-mcp-on-cloud-run, claim/toolbox-execute-sql-not-for-production]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.5-mcp-tools-and-integrations.md"
reviewed: 2026-11-17
review-by: 2027-02-17
---

**Concept.** There are three ways to give an agent tools over MCP on Google Cloud, set apart by who owns the integration. A **Google Cloud MCP server** is a remote server Google runs for one of its services (BigQuery, Spanner, GKE and others); you enable the product API and grant IAM roles. **MCP Toolbox for Databases** is an open-source server you run in front of your databases, with each tool defined as a fixed statement and typed parameters. A **custom MCP server** wraps an internal API; you build, host and secure it.

**Why it matters.** Use a Google Cloud MCP server when one exists for the service: Google hosts and updates it. Move to Toolbox for queries against your own tables, and to a custom server only for systems nothing else covers.

**Limits.** The list of supported products and their launch stages change; individual servers may be in Preview. The access-control page (docs.cloud.google.com/mcp/access-control) also says non-Google Cloud MCP servers do not need the MCP Tool User role.
