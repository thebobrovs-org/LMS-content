---
id: concept/untrusted-agent-code
type: concept
status: proposed
title: "Agent-generated code is untrusted: isolate where it runs, keep production credentials out, and review before it ships"
scope: "Coding agents and agent products as documented on 2026-11-17. The three rules are this path's teaching framing; the isolation options and their defaults are product-specific and change"
sources:
  - "Antigravity documentation, sandbox and permissions pages, antigravity.google/docs (retrieved 2026-11-17: terminal sandbox enabled by default in the app; sandboxed commands run without network access by default; ~/.ssh and .env blocked; presets Request Review, Default, Auto, Turbo; rules resolve Deny > Ask > Allow; the CLI sandbox is off by default)"
  - "Google Cloud, Cloud Workstations security best practices and agent-optimized development, docs.cloud.google.com/workstations/docs (retrieved 2026-11-17: dedicated VM per workstation; disable public IPs; VPC Service Controls; attach a service account; keep workstations single-user)"
  - "Google Cloud, \"AI security and safety\" for MCP, docs.cloud.google.com/mcp/ai-security-safety (retrieved 2026-11-17: create an agent identity; principle of least privilege; deny policy on read-write tool access to production resources)"
  - "Google Cloud, \"Use IAM securely\", docs.cloud.google.com/iam/docs/using-iam-securely (retrieved 2026-11-17: avoid basic roles in production; grant Owner only when nearly universal access is required)"
touches:
  - agentic-ai/coding-agent-sandboxes
tags: [agents, coding-agents, security, sandboxing]
terms: [terminal sandbox, permission preset, cloud workstations, gke agent sandbox]
related: [claim/gke-agent-sandbox-model, concept/coding-agent-customization-mechanisms]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/2.4-coding-agent-sandboxes.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** A coding agent's code and commands can be wrong, or steered by an instruction hidden in content it read, and they run with the permissions and credentials around them. Three rules follow: treat agent-generated code as untrusted until reviewed and tested; isolate where it runs and keep production credentials out; keep a person reviewing every patch that ships.

**Isolation by scenario.** One developer: a terminal sandbox with a preset and rules that ask before risky commands (Antigravity's Default preset, or Request Review, which asks before every command, where the sandbox is unavailable). An enterprise team: managed per-developer machines such as Cloud Workstations, with no public IP, a perimeter and a minimal service account. An agent product running generated code for many users: a kernel-isolated sandbox per run, such as GKE Agent Sandbox, with egress restricted. Every option still needs least-privilege credentials; isolation limits damage, it does not make broad roles such as Owner safe.

**Shipping.** Agent patches go through a branch, CI tests and scans that the agent cannot mark as passing, and human review, with the main branch protected on the server.
