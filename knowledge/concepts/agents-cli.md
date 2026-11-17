---
id: concept/agents-cli
type: concept
status: proposed
title: "Agents CLI packages the agent lifecycle as skills and commands that a coding agent uses"
scope: "Agents CLI as documented on 2026-11-17 (release notes up to 1.14.0). Commands, flags and skills change quickly; the split between skills (what to do) and commands (doing it), and the choice of driver by cost of a mistake, are this path's teaching framing"
sources:
  - "Agents CLI README, github.com/google/agents-cli (retrieved 2026-11-17: \"agents-cli is a tool for coding agents, not a coding agent itself\"; uvx google-agents-cli setup; seven skills; works with Antigravity CLI, Claude Code and Codex)"
  - "Agents CLI documentation, \"Lifecycle\" and \"Skills reference\", google.github.io/agents-cli/guide/lifecycle/ and google.github.io/agents-cli/reference/skills/ (retrieved 2026-11-17: phases Spec, Scaffold, Build and Orchestrate, Evaluate, Deploy, Publish, Observe with their skills and commands; the workflow skill is always active; two ways to drive it, through a coding agent or standalone)"
  - "Agents CLI documentation, \"CLI reference\", google.github.io/agents-cli/cli/ (retrieved 2026-11-17 through a fetch that was truncated after about a third of the page: create -i \"Enable interactive prompts for human use\"; -y \"Non-interactive: skip prompts and use defaults\"; deploy --dry-run runs pre-flight and read-only Google Cloud checks)"
  - "Agents CLI documentation, \"Deployment\", \"Evaluation\" and \"Authentication\" guides, google.github.io/agents-cli/guide/ (retrieved 2026-11-17: without --project the deploy stops to confirm the project; eval run exits 1 when a metric misses its threshold so CI can gate on it; a Gemini API key covers local playground, run and eval without a Google Cloud project; Agents CLI does not control coding agent authentication)"
touches:
  - agentic-ai/agents-cli
tags: [agents, coding-agents, agents-cli, adk, deployment]
terms: [agents cli, skill, agent runtime]
related: [concept/coding-agent-customization-mechanisms, concept/skill-progressive-disclosure]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/2.3-agents-cli.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** Agents CLI is a command-line tool plus seven skills. Setup installs the skills into the coding agents on a machine (Antigravity CLI, Claude Code, Codex, Cursor and others). The skills tell the coding agent what to do in each phase of building an agent (spec, scaffold, build, evaluate, deploy, publish, observe) and which command to run; the commands (`create`, `run`, `playground`, `eval run`, `deploy`, `publish gemini`) do the work. It is a tool for coding agents, not a coding agent.

**Drivers.** A step can be driven by a coding agent (through the skills, within its permission settings), by a person (with `-i` prompts), or by an unattended pipeline (every choice as a flag, gating on exit codes such as `eval run` exiting 1 when a metric misses a configured threshold). The CLI documents interactive and non-interactive options but names no "agent mode" or "human mode"; the plan's term is not used. Let a coding agent drive cheap local steps and keep a person approving deploys and publishing to shared resources, with `deploy --dry-run` as evidence.

**Limits.** The CLI reference was read through a truncated fetch, so flags beyond its first third (such as `publish gemini` options) rest on a summary of the page. Observability has no command: generated projects export traces to Cloud Trace by default, and `--otel-to-cloud` applies only to local `run` and `playground`. Review every 90 days.
