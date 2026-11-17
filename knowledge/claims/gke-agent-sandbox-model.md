---
id: claim/gke-agent-sandbox-model
type: claim
status: proposed
title: "GKE Agent Sandbox is a user-installed controller that gives each sandbox a kernel-isolated Pod, with public egress open by default"
scope: "GKE as documented on 2026-11-17. Launch stage, defaults and the recommendation of Agent Substrate are dated; re-check before quizzing them after the review date"
sources:
  - "Google Cloud, \"About Agent Sandbox on GKE\", docs.cloud.google.com/kubernetes-engine/docs/concepts/machine-learning/agent-sandbox (retrieved 2026-11-17, page updated 2026-11-10: GKE Sandbox with gVisor or microVMs; Sandbox, SandboxTemplate, SandboxWarmPool, SandboxClaim; you install the Agent Sandbox controller and are responsible for upgrading it; default deny network policy for Pods the controller creates from a SandboxTemplate, none for a Sandbox created directly; for most agent workloads, use Agent Substrate on GKE instead)"
  - "Google Cloud, Agent Sandbox quickstart, docs.cloud.google.com/kubernetes-engine/docs (retrieved 2026-11-17: managed network policy blocks ingress except from the Sandbox Router and egress to RFC 1918 ranges, cluster DNS and the metadata server; egress to the public internet is allowed; automountServiceAccountToken false)"
  - "Google Cloud Blog, May 2026 (retrieved 2026-11-17: \"GKE Agent Sandbox is now generally available\"; Agent Substrate described as a new open source project)"
touches:
  - agentic-ai/coding-agent-sandboxes
tags: [agents, security, sandboxing, gke, launch-stage]
terms: [gke agent sandbox]
related: [concept/untrusted-agent-code]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/2.4-coding-agent-sandboxes.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Claim.** GKE Agent Sandbox, generally available since May 2026, runs each sandbox as a Pod with its own kernel boundary (gVisor or a microVM), handed out from warm pools through claims. It is not a managed add-on: you install the controller on your cluster and upgrade it. Pods created from a SandboxTemplate get a default-deny network policy that blocks internal ranges, cluster DNS and the metadata server, but public internet egress is allowed by default, and a Sandbox created directly gets no policy.

**Limits.** All Google pages were read through a fetch summary; the open-source README was read raw. The docs pages carry no launch-stage label, so GA rests on the May 2026 blog. Google's docs now suggest Agent Substrate for most agent workloads, an open-source project with no launch stage, so the lesson presents Agent Sandbox as the documented choice for a dedicated Pod per agent, GPUs or Autopilot and does not quiz Substrate. Review every 90 days.
