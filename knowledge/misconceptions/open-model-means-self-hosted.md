---
id: misconception/open-model-means-self-hosted
type: misconception
status: proposed
title: "Choosing an open model means you have to host it yourself"
scope: "Model choice on Google Cloud (Model Garden), as of November 2026"
sources:
  - "Google Cloud, Agent Platform documentation, docs.cloud.google.com/gemini-enterprise-agent-platform/models/open-models/choose-serving-option (open models served as MaaS or self-deployed)"
  - "Google Cloud, Generative AI pricing, cloud.google.com/vertex-ai/generative-ai/pricing (Gemma 4 offered as a managed model, priced per token)"
touches:
  - agentic-ai/choosing-a-model
  - objective:agentic-ai/choosing-a-model#model-axes
  - item:agentic-ai/choosing-a-model#open-means-self-host
  - item:agentic-ai/choosing-a-model#open-not-self-hosted
tags: [models, serving]
related: [concept/model-serving-options]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/0.3-choosing-a-model.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**The model.** "Open source means self-hosted": picking Gemma commits the team to GPUs and a serving stack.

**How it shows.** A learner rules out an open model because the team can't run infrastructure, or picks self-deployment in a scenario that only asked for open weights.

**The correcting example.** Model Garden offers some open models, Gemma among them, as managed endpoints. Openness decides what you may do with the weights; serving decides who runs them. A team can start with an open model on a managed endpoint and self-deploy later only if a requirement calls for it.
