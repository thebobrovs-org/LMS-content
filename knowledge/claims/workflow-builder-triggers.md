---
id: claim/workflow-builder-triggers
type: claim
status: proposed
title: "A Workflow Builder workflow starts from a manual, schedule or event trigger; event triggers are configured from a connector and poll"
scope: "Gemini Enterprise Workflow Builder workflows, as documented on 2026-11-17"
sources:
  - "Google Cloud, Workflows overview, docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/workflows (updated 2026-11-10, retrieved 2026-11-17; Manual trigger, Schedule trigger, Event trigger; manual runs by @-mention in chat)"
  - "Google Cloud, \"Configure an event trigger\", docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/configure-event-trigger (updated 2026-11-10, retrieved 2026-11-17; App event, then connector and event; supported connectors Confluence, Gmail, Google Calendar, Google Drive, Jira Cloud, OneDrive, Outlook, ServiceNow, SharePoint, Teams; always add filters; polling; delay of 5-10 minutes)"
  - "Google Cloud, \"Turn a workflow on or off\", docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/publish-workflows (updated 2026-11-10, retrieved 2026-11-17; turning a version off removes its schedules and event triggers)"
  - "Google Cloud, Workflow Builder quotas and limits, docs.cloud.google.com/gemini/enterprise/docs/workflow-builder/quotas-and-limits (updated 2026-11-10, retrieved 2026-11-17; schedules multi-region only; scheduled runs that affect other people pause for approval in chat)"
touches:
  - agentic-ai/workflow-builder
  - objective:agentic-ai/workflow-builder#configure-workflow
  - item:agentic-ai/workflow-builder#three-triggers
  - item:agentic-ai/workflow-builder#event-trigger-where
  - item:agentic-ai/workflow-builder#event-trigger-inline
  - item:agentic-ai/workflow-builder#drive-trigger
  - item:agentic-ai/workflow-builder#turn-off-effect
tags: [google-cloud, low-code, gemini-enterprise]
terms: [trigger, event trigger, schedule trigger, manual trigger, App event]
related: [claim/workflow-builder-step-types, claim/workflow-builder-formerly-agent-designer]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/1.1-workflow-builder.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** A Workflow Builder workflow has one of three triggers: manual (a user @-mentions the workflow in the Gemini Enterprise chat), schedule (a frequency and a time zone) or event (a change in a connected app). An event trigger is configured in the trigger settings by choosing App event, a connector and its event, with filters; it is the workflow's trigger, not a step added on the canvas (event triggers "don't appear as intermediate step nodes in the canvas flow", per the workflows overview). Event triggers poll, so runs can start 5 to 10 minutes after the change, and they poll only while the workflow is turned on.

**Limits.** The event connectors are a subset of the connectors a Gemini Agent step can use (Google Chat, Notion, Salesforce and Slack are not on the event list as of the retrieval date). The workflows page and the quotas page describe schedule frequencies differently (minutes and custom cron against hourly to annually), so the lesson names only "daily or weekly". Turning a workflow off removes its schedules and event triggers.
