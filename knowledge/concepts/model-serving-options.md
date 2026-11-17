---
id: concept/model-serving-options
type: concept
status: proposed
title: "Model size, openness and serving are three separate choices"
scope: "Choosing a language model for an agent on Google Cloud (Model Garden, Agent Platform, GKE), as of November 2026"
sources:
  - "Google Cloud, Professional Agentic Architect exam guide, services.google.com/fh/files/misc/professional_agentic_architect_exam_guide_english.pdf (section 3.1: LLM vs SLM, self-hosted vs SaaS, open-source vs proprietary)"
  - "Google Cloud, Agent Platform documentation, docs.cloud.google.com/gemini-enterprise-agent-platform/models/open-models/choose-serving-option (open models served as MaaS or self-deployed)"
  - "Google Cloud, Serve Gemma open models using GPUs on GKE with vLLM, docs.cloud.google.com/kubernetes-engine/docs/tutorials/serve-gemma-gpu-vllm"
  - "Google Cloud, Generative AI pricing, cloud.google.com/vertex-ai/generative-ai/pricing (Gemma 4 offered as a managed model, priced per token)"
touches:
  - agentic-ai/choosing-a-model
  - objective:agentic-ai/choosing-a-model#model-axes
  - objective:agentic-ai/choosing-a-model#match-requirement
  - item:agentic-ai/choosing-a-model#axis-flash-vs-pro
  - item:agentic-ai/choosing-a-model#eu-residency
  - item:agentic-ai/choosing-a-model#three-axes
tags: [models, serving]
related: [misconception/open-model-means-self-hosted]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/0.3-choosing-a-model.md"
reviewed: 2026-11-17
review-by: 2027-05-17
---

**The concept.** Choosing a model is three decisions. *Size*: a large model reasons better; a small one is faster and cheaper per request. *Openness*: a proprietary model is used through its provider's service; an open-weights model can be held, tuned and run where you choose. *Serving*: a managed endpoint (model as a service) has nothing to operate and is paid for by use; a self-deployed model runs on an endpoint or cluster you control and costs compute while it is provisioned. Managed is pay-as-you-go by default, with reserved capacity as an option.

**Worked example.** Moving from Gemini Pro to Gemini Flash changes only size. Moving Gemma from a managed endpoint to your own GKE cluster changes only serving. A data-residency requirement acts on where the model is served, not on its size or openness: many managed models, Gemini among them, can be called on an EU regional or multi-region endpoint (never the global endpoint, which gives no residency guarantee), though support varies by model.

**Default.** Start with a managed model; self-deploy for a stated need: control of where it runs, holding the weights, or a measured cost saving at steady high volume. The size choice has no official Google rule; it is engineering judgement confirmed by evaluation.
