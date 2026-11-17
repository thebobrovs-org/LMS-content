---
id: claim/adk-cloud-run-in-memory-sessions
type: claim
status: proposed
title: "An ADK agent on Cloud Run without a session service loses its sessions when an instance is recycled"
scope: "ADK (Python) deployed with adk deploy cloud_run, as documented on 2026-11-17"
sources:
  - "ADK documentation, \"Deploy to Cloud Run\", github.com/google/adk-docs/blob/main/docs/deploy/cloud-run.md (retrieved 2026-11-17: when --session_service_uri and --artifact_service_uri are not set, the deployed container falls back to the in-memory session and artifact services, and sessions and artifacts are lost whenever a Cloud Run instance is recycled; agentengine:// selects managed sessions; gcloud flags such as --min-instances pass through after --)"
  - "Google Cloud, \"Set minimum instances\", docs.cloud.google.com/run/docs/configuring/min-instances (last updated 2026-11-12: you can set a minimum number of instances to avoid slow container start times and reduce service latency)"
  - "Google Cloud, \"Billing settings\", docs.cloud.google.com/run/docs/configuring/billing-settings (last updated 2026-11-12: request-based instances are charged only when they process requests, start and shut down; instance-based instances are charged for their entire lifecycle)"
touches:
  - agentic-ai/deploying-agents
tags: [agents, deployment, cloud-run, adk]
terms: [session service, in-memory, min instances, request-based billing, instance-based billing]
related: [concept/agent-runtime-choice]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.3-deploying-agents.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** Deployed to Cloud Run with no session or artifact service configured, an ADK agent uses in-memory services, so its sessions and artifacts are lost whenever an instance is recycled (and are not shared between instances). Configure a persistent session service: a database URL or Agent Runtime's managed sessions (`agentengine://`).

**Related Cloud Run facts.** Minimum instances avoid slow container starts at the price of paying for idle instances. Request-based billing charges only while an instance handles requests, starts or shuts down; instance-based billing charges for the whole lifecycle.
