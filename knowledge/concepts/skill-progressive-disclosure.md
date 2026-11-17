---
id: concept/skill-progressive-disclosure
type: concept
status: proposed
title: "MCP gives a coding agent tools, a skill gives it know-how, and a skill loads progressively"
scope: "Coding agents (Antigravity and Claude Code) as documented on 2026-11-17. File names and settings are product-specific and change often; the split between tools and know-how, and the least-tools rule, are this path's teaching framing"
sources:
  - "Antigravity documentation, \"Skills\", antigravity.google/docs/skills (retrieved 2026-11-17: a skill is a folder containing a SKILL.md file; description is what the agent sees when deciding whether to apply the skill; on every turn the agent sees a list of available skills with names and descriptions, and reads the full SKILL.md if a skill looks relevant)"
  - "Antigravity documentation, \"MCP\", antigravity.google/docs/mcp (retrieved 2026-11-17: workspace .agents/mcp_config.json; serverUrl; authProviderType google_credentials; enabledTools allowlist, when set all other tools on the server are hidden)"
  - "Claude Code documentation, \"Extend Claude with skills\", code.claude.com/docs/en/skills (retrieved 2026-11-17: skill descriptions are loaded into context, full skill content only loads when invoked; supporting files loaded when needed; scripts executed, not loaded; Agent Skills open standard)"
  - "Claude Code documentation, \"Connect Claude Code to tools via MCP\" and \"Configure permissions\", code.claude.com/docs/en/mcp and code.claude.com/docs/en/permissions (retrieved 2026-11-17: project scope in .mcp.json; mcp__server__tool deny rules remove a tool from context)"
  - "Google Cloud, \"Configure MCP in an AI application\", docs.cloud.google.com/mcp/configure-mcp-ai-application (retrieved 2026-11-17: roles/mcp.toolUser to call Google Cloud MCP server tools)"
  - "Google Cloud, \"Use the BigQuery MCP server\", docs.cloud.google.com/bigquery/docs/use-bigquery-mcp (retrieved 2026-11-17: endpoint bigquery.googleapis.com/mcp; execute_sql is the only tool that is not read-only)"
touches:
  - agentic-ai/configuring-coding-agents
tags: [agents, coding-agents, mcp, skills]
terms: [mcp server, skill, progressive disclosure, enabledTools, SKILL.md]
related: [concept/google-cloud-mcp-servers]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/2.1-configuring-coding-agents.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** A coding agent is configured along two axes. An MCP server gives it tools: actions against live systems, each declared with a name, description and typed parameters. A skill gives it know-how: a folder headed by `SKILL.md` (a `name`, a `description`, then instructions), with optional reference files and scripts. A short project instructions file (`AGENTS.md`, `GEMINI.md`, `CLAUDE.md`) holds the facts needed on every task.

**Progressive disclosure.** The agent sees every skill's name and description on every turn (unless the skill is set to manual-only), reads the full `SKILL.md` only when a task matches the description or the user invokes it, and reads supporting files only when the body points to them; scripts are meant to be run rather than read, so normally only their output enters the context. A skill therefore costs about one line of context until used, and a vague description is the usual reason a skill is never picked up.

**Least tools.** Expose only the tools the task needs (Antigravity `enabledTools`, a Claude Code deny rule) and grant only the IAM roles it needs on the server side (`roles/mcp.toolUser` plus the product's roles). Every exposed tool is something the model can call by mistake or under prompt injection; IAM, not the agent's configuration, is what the server enforces.

**Canonical terms.** MCP server, skill, progressive disclosure, project instructions file.
