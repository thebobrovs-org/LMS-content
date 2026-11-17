---
id: claim/skill-registry-stage
type: claim
status: proposed
title: "Skill Registry is in public Preview on Agent Platform and is to become part of Agent Registry"
scope: "Gemini Enterprise Agent Platform as documented on 2026-11-17. The launch stage is dated: re-check before quizzing it after the review date"
sources:
  - "Google Cloud Blog, \"I/O 26 news for agent developers on Google Cloud\", 19 May 2026, cloud.google.com/blog/topics/developers-practitioners/io26-news-for-agent-developers-on-google-cloud (retrieved 2026-11-17: Skill Registry (public preview); skills accessible via the Managed Agents API, Agent Platform SDK and ADK via SkillToolset; Skill Registry will be part of Agent Registry shortly)"
  - "Google Cloud, \"Skill Registry overview\", docs.cloud.google.com/gemini-enterprise-agent-platform/build/skill-registry (retrieved 2026-11-17, page updated 2026-11-12: a repository for managing agent skills; each revision is an immutable snapshot; uploads are a zip with SKILL.md and YAML frontmatter at the root)"
touches:
  - agentic-ai/customizing-coding-agents
tags: [agents, skills, agent-platform, launch-stage]
terms: [skill registry, agent registry]
related: [concept/coding-agent-customization-mechanisms]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/2.2-customizing-coding-agents.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** As of November 2026, Skill Registry is a public Preview feature of Gemini Enterprise Agent Platform, announced on 19 May 2026. It stores agent skills as versioned entities in a Google Cloud project, and Google has said it will become part of Agent Registry.

**Limits.** The author read both pages through a fetch summary. No GA date and no release-notes entry were found, and no document says the move into Agent Registry is complete, though the overview page says standalone skills can already be managed within Agent Registry. The zip-root requirement for SKILL.md comes from the page's validation rules as read through the fetch summary; confirm it on the live page before approval. Google documents access through the Managed Agents API, the Agent Platform SDK and ADK, and does not document coding agents such as Antigravity or Claude Code reading Skill Registry natively, so the lesson does not claim that. The quiz item plugin-or-registry depends on that absence: re-check it whenever this claim is reviewed. Review every 90 days.
