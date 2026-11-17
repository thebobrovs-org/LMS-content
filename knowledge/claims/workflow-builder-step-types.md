---
id: claim/workflow-builder-step-types
type: claim
status: proposed
title: "Workflow Builder workflow steps: Gemini Agent, flow control (Condition, Filter, Loop), human in the loop (Request info, Approval), MCP and existing-agent steps"
scope: "Gemini Enterprise Workflow Builder workflows, as documented on 2026-11-17"
sources:
  - "Google Cloud, Workflows overview, docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/workflows (updated 2026-11-10, retrieved 2026-11-17; Gemini Agent with instructions, knowledge, connected apps, output format plain text or JSON schema; search actions and add-or-update actions; adding or updating data through connectors requires human review; write actions depend on search actions, ENTITY_NOT_FOUND; MCP servers as steps or tools; existing agents)"
  - "Google Cloud, \"Use connector actions\", docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/use-connector-actions (retrieved 2026-11-17; adding or updating data through connectors requires human review)"
  - "Google Cloud, flow control steps, docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/flow-control-steps (updated 2026-11-10, retrieved 2026-11-17; Condition, Filter, Loop)"
  - "Google Cloud, human-in-the-loop steps, docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/use-hitl-steps (updated 2026-11-10, retrieved 2026-11-17; Request info and Approval; the run pauses with a Needs Review status in the Runs tab)"
  - "Google Cloud, Workflow Builder known issues, docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/known-issues (updated 2026-11-10, retrieved 2026-11-17; the conversational designer can't add approvals, event triggers or filters; event-triggered runs failing with RESOURCE_EXHAUSTED are not retried automatically; existing agent steps support only ADK and A2A registered agents)"
touches:
  - agentic-ai/workflow-builder
  - objective:agentic-ai/workflow-builder#configure-workflow
  - objective:agentic-ai/workflow-builder#operate-workflow
  - item:agentic-ai/workflow-builder#step-families
  - item:agentic-ai/workflow-builder#branch-on-json
  - item:agentic-ai/workflow-builder#entity-not-found
  - item:agentic-ai/workflow-builder#needs-review-status
tags: [google-cloud, low-code, gemini-enterprise]
terms: [Gemini Agent step, Condition, Filter, Loop, Request info, Approval, Needs Review]
related: [claim/workflow-builder-triggers]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/1.1-workflow-builder.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** A workflow is built from these step types: Gemini Agent (a model acting on instructions, knowledge and connected apps, returning plain text or JSON matching a schema, stored as a variable); flow control (Condition, Filter, Loop); human in the loop (Request info, which asks a person questions, and Approval, which pauses for sign-off); MCP steps; and existing-agent steps (registered ADK or A2A agents only, per the known issues' limitations). In a Gemini Agent step, a connector's add-or-update actions depend on its search actions to find records, and adding or updating data through connectors requires human review. A run paused at a human-in-the-loop step shows Needs Review in the Runs tab.

**Limits.** Google's pages don't say how an approval's reviewer is chosen or what happens on rejection or timeout, so the lesson doesn't claim either. The known issues are open as of the retrieval date and may be fixed later.
