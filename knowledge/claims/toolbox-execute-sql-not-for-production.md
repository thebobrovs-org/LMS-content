---
id: claim/toolbox-execute-sql-not-for-production
type: claim
status: proposed
title: "MCP Toolbox's execute-SQL tools are for developer workflows with a human in the loop, not production agents"
scope: "MCP Toolbox for Databases, as documented on 2026-11-17"
sources:
  - "Google, MCP Toolbox for Databases, postgres-execute-sql tool page, github.com/googleapis/mcp-toolbox/blob/main/docs/en/integrations/postgres/tools/postgres-execute-sql.md (retrieved 2026-11-17; \"This tool is intended for developer assistant workflows with human-in-the-loop and shouldn't be used for production agents.\")"
  - "Google, MCP Toolbox for Databases, authentication documentation, github.com/googleapis/mcp-toolbox/tree/main/docs/en/documentation/configuration/authentication (retrieved 2026-11-17; authorized invocation with authRequired; authenticated parameters filled from an OIDC claim)"
touches:
  - agentic-ai/mcp-tools-and-integrations
  - objective:agentic-ai/mcp-tools-and-integrations#database-tools
  - item:agentic-ai/mcp-tools-and-integrations#free-form-sql
  - item:agentic-ai/mcp-tools-and-integrations#customer-scope
  - item:agentic-ai/mcp-tools-and-integrations#named-queries-card
  - item:agentic-ai/mcp-tools-and-integrations#authenticated-parameter
tags: [agents, mcp, databases, security]
terms: [MCP Toolbox for Databases, execute-sql, authenticated parameters]
related: [concept/google-cloud-mcp-servers]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/3.5-mcp-tools-and-integrations.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**Claim.** MCP Toolbox for Databases offers execute-SQL tool types that run any statement the caller supplies, and documents them as meant for developer assistant workflows with a human in the loop, not production agents. For production, it supports tools with a fixed statement and typed parameters, and authenticated parameters whose values come from a claim in the caller's verified token rather than from the model.

**Limits.** The quoted warning is on the PostgreSQL tool page; other databases' execute-SQL pages may word it differently. The configuration format changed in 2026 (multi-document YAML with kind and type).
