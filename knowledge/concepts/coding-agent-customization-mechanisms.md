---
id: concept/coding-agent-customization-mechanisms
type: concept
status: proposed
title: "Coding-agent customisations differ in what they guarantee: hooks enforce, rules and skills guide"
scope: "Coding agents (Antigravity and Claude Code) as documented on 2026-11-17. File names, events and fields are product-specific and change often; the guarantee each mechanism gives is this path's teaching framing"
sources:
  - "Antigravity documentation, \"Rules\", antigravity.google/docs/rules (retrieved 2026-11-17: AGENTS.md and GEMINI.md always on; .agents/rules/*.md with trigger always_on, model_decision, glob or manual; 24,000 bytes per file; 20,000-token budget for global and always-on rules)"
  - "Antigravity documentation, \"Hooks\", antigravity.google/docs/hooks (retrieved 2026-11-17: events SessionStart, PreToolUse, PostToolUse, PreInvocation, PostInvocation, Stop; PreToolUse decision deny hard blocks execution)"
  - "Antigravity documentation, \"Subagents\" and \"Plugins\", antigravity.google/docs/subagents and antigravity.google/docs/plugins (retrieved 2026-11-17: a subagent does not inherit the parent's conversation history; a plugin bundles skills, MCP servers, agents, rules and hooks into a single versioned unit)"
  - "Claude Code documentation, \"How Claude remembers your project\", code.claude.com/docs/en/memory (retrieved 2026-11-17: CLAUDE.md is context, not enforced configuration; use a PreToolUse hook to block an action)"
  - "Claude Code documentation, \"Automate workflows with hooks\" and \"Hooks reference\", code.claude.com/docs/en/hooks-guide and code.claude.com/docs/en/hooks (retrieved 2026-11-17: hooks give deterministic control; exit code 2 blocks a PreToolUse call and only reports back for PostToolUse)"
  - "Claude Code documentation, \"Create custom subagents\", code.claude.com/docs/en/sub-agents (retrieved 2026-11-17: each subagent runs in its own context window with its own tool access)"
touches:
  - agentic-ai/customizing-coding-agents
tags: [agents, coding-agents, hooks, skills, plugins]
terms: [rule, hook, skill, subagent, plugin]
related: [concept/skill-progressive-disclosure, claim/skill-registry-stage]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/2.2-customizing-coding-agents.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** A coding agent offers five customisation mechanisms, and the useful difference between them is what each one guarantees.

- A **rule** puts guidance in the agent's context, always or when a trigger such as a file pattern matches. The model reads it and decides, so a rule guides but does not enforce.
- A **hook** is a command the agent harness runs on a lifecycle event, whatever the model decides. A hook before a tool call (`PreToolUse`) can block it; a hook after the call (`PostToolUse`) cannot undo it. By default a hook that crashes or times out does not block, so a policy hook should deny explicitly.
- A **skill** loads its know-how when a task matches its description, then guides like a rule.
- A **subagent** works in its own context with its own instructions and, optionally, its own model and tool list. Its tool list is enforced: a subagent without edit tools cannot edit.
- A **plugin** packages skills, hooks, subagents and MCP servers (and, in Antigravity, rules) as one versioned unit. It adds no guarantee of its own.

Rule of thumb: if it must happen every time, use a hook; if it is guidance, use a rule or a skill. A hook enforces on one developer's machine and only for the events its matcher covers, so the same check belongs in CI as the final gate.
