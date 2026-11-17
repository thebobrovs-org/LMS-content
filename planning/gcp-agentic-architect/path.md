# Google Cloud Professional Agentic Architect: path blueprint (TLDR)

**Path id:** `gcp-agentic-architect` · **Status:** MAP APPROVED (2026-11-17, Shachar) · building topic by topic
**Persona (SME):** [`personas/agentic-ai.md`](../../personas/agentic-ai.md)
**Exam guide:** [Professional Agentic Architect exam guide](https://services.google.com/fh/files/misc/professional_agentic_architect_exam_guide_english.pdf) (retrieved 2026-11-15) · [official Google Skills learning path](https://www.skills.google/paths/4525)

**Audience:** cloud architects and senior engineers who know Google Cloud basics
(projects, IAM, Cloud Run, GKE), can read Python, and have used an LLM chat app,
but have not designed, evaluated or secured an agent in production. Many are
preparing for the Professional Agentic Architect exam.

**Outcome (definition of done):** the learner can design an agentic system on
Google Cloud end to end and defend each choice: low-code or code, which model,
how it reaches enterprise data and tools, how agents coordinate, how it is
evaluated before and after launch, where it runs, and how its identity, access
and guardrails are set. They can answer scenario questions of the kind the exam
asks, and they are ready for its two hands-on labs.

## Why
Agent products on Google Cloud were renamed and reshaped through 2025 and 2026
(Agentspace and Agent Designer became Gemini Enterprise and Workflow Builder,
Vertex AI Search became Agent Search, Agent Engine became Agent Runtime). Exam
candidates and practitioners carry a tangle of old names and half-true mental
models. This path gives them one current map and the reasoning behind each
architectural choice, so they pick the right tool for a scenario instead of
memorising product lists.

## What
The five exam sections, taught as architecture rather than trivia: low-code
agents in Gemini Enterprise, coding agents (Antigravity, Claude Code on Google
Cloud), custom agents with ADK (models, tools, sessions, memory, RAG, MCP, A2A,
multi-agent workflows), evaluation and deployment, and security and governance
(Agent Identity, OAuth, Agent Gateway, Agent Registry, Model Armor, human in the
loop). Section weights set how many topics each section gets: section 3 (33%) gets the most.

**Non-goals:** not a general ML or LLM-training course (the `scaling-llms` and
`tpu-training-infra` paths cover that), not a click-by-click console tour, not a
question dump. Lesson quizzes test what the lesson taught. No exam questions from
brain-dump sites appear in this public repo.

## How
Each topic is a concept lesson built around **one architectural decision** (when
to use X instead of Y, and why), with a figure or worked example, and a
simulation only where the behaviour unfolds over time or depends on tuned inputs
(five sims across the path). Labs are **codelabs**: we link Google's official
codelabs and Skills labs rather than build cloud labs. Every product fact that
could change (names, launch stages, limits, defaults) becomes a `knowledge/`
record with a source and the lesson carries an `updated` date, so a rename means
one record and a few lessons to revisit, not a hunt.

Built blueprint-first: this doc, then a plan per topic, then topic by topic with
sign-off between each, core first, then one exam section at a time.

## Topic map

> The path runs **subject by subject**: the core track first, then each exam section from L100 to L400, so a learner finishes one subject before the next. Levels are **depth** within a subject: L100 understand, L200 configure and build, L300 design and integrate, L400 operate and harden.
> Topic numbers follow the track: 0.x core, 1.x to 5.x the exam sections. Each topic needs an approved plan (`topics/<id>-<slug>.md`) before it is built. All topic ids live under `topics/agentic-ai/`.

**Status legend:** planned → plan-approved → in progress → on staging → signed off → published

### Core: the shared foundation

| ID | Level | Topic (`id`) | One-line objective | Visual / lab | Status |
|----|-------|--------------|--------------------|--------------|--------|
| 0.1 | 100 | `what-is-an-agent` | Name the parts of an agent (model, instructions, tools, loop, state) and what each contributes. | figure | published |
| 0.2 | 100 | `google-agent-platform-map` | Place each in-scope product on the map by what it does. | figure | in review |
| 0.3 | 200 | `choosing-a-model` | Separate the three axes (size, openness, serving) and say what each trades. | figure | plan-approved |
| 0.4 | 300 | `low-code-or-code` | Choose low-code, code or a hybrid for a scenario and defend it. | figure | plan-approved |

### S1 Low-code agents (exam section 1, 13%)

| ID | Level | Topic (`id`) | One-line objective | Visual / lab | Status |
|----|-------|--------------|--------------------|--------------|--------|
| 1.1 | 100 | `workflow-builder` | Choose a chat agent or a workflow for a use case. | figure + codelab | plan-approved |
| 1.2 | 200 | `cx-agent-studio-flows` | Choose an instruction-based or flow-based agent for a use case. | **sim `cx-route-resolver`** | plan-approved |
| 1.3 | 200 | `enterprise-data-gemini-enterprise` | Explain the roles of an app, a data store and a connector. | figure | plan-approved |

### S2 Coding agents (exam section 2, 17%)

| ID | Level | Topic (`id`) | One-line objective | Visual / lab | Status |
|----|-------|--------------|--------------------|--------------|--------|
| 2.1 | 100 | `configuring-coding-agents` | Add an MCP server to a coding agent and scope the tools it exposes. | figure + codelab | plan-approved |
| 2.2 | 200 | `customizing-coding-agents` | Choose a rule, hook, skill, subagent or plugin for a requirement. | figure | plan-approved |
| 2.3 | 300 | `agents-cli` | Explain what Agents CLI adds to a coding agent. | figure | plan-approved |
| 2.4 | 400 | `coding-agent-sandboxes` | Choose an isolation option for a scenario. | figure | plan-approved |

### S3 Custom agents (exam section 3, 33%)

| ID | Level | Topic (`id`) | One-line objective | Visual / lab | Status |
|----|-------|--------------|--------------------|--------------|--------|
| 3.1 | 100 | `the-agent-loop` | Trace a multi-step request through each model call and tool call. | **sim `agent-loop-stepper`** | on staging |
| 3.2 | 200 | `adk-agents-and-tools` | Define an LlmAgent with a model, instruction and function tools. | figure + codelab | on staging |
| 3.3 | 200 | `sessions-state-memory` | Distinguish a session's history and state from long-term memory. | figure | plan-approved |
| 3.4 | 300 | `rag-pipelines` | Name the RAG stages and the decision at each. | **sim `rag-retrieval-tuner`** | plan-approved |
| 3.5 | 300 | `mcp-tools-and-integrations` | Choose a managed MCP server, MCP Toolbox or a custom MCP server for a system. | figure | plan-approved |
| 3.6 | 300 | `a2a-and-mcp` | Choose A2A or MCP for an integration. | figure | plan-approved |
| 3.7 | 400 | `multi-agent-orchestration` | Choose sequential, parallel, loop, graph or LLM-routed orchestration for a task. | **sim `orchestration-patterns`** | plan-approved |
| 3.8 | 400 | `context-engineering` | Break a turn's context into components and find the largest. | figure | plan-approved |

### S4 Evaluate and deploy (exam section 4, 22%)

| ID | Level | Topic (`id`) | One-line objective | Visual / lab | Status |
|----|-------|--------------|--------------------|--------------|--------|
| 4.1 | 100 | `agent-quality-basics` | Name the dimensions of agent quality and an example failure for each. | figure | on staging |
| 4.2 | 200 | `agent-eval-datasets` | Build a golden dataset with expected trajectories and responses. | figure + codelab | on staging |
| 4.3 | 200 | `deploying-agents` | Choose Agent Runtime, Cloud Run or GKE from requirements. | figure | on staging |
| 4.4 | 300 | `agent-eval-criteria` | Predict whether a trajectory passes exact, in-order or any-order matching. | **sim `trajectory-match-explorer`** | plan-approved |
| 4.5 | 400 | `agent-observability-troubleshooting` | Read an agent trace to find slow spans and repeated calls. | figure | plan-approved |

### S5 Secure and govern (exam section 5, 15%)

| ID | Level | Topic (`id`) | One-line objective | Visual / lab | Status |
|----|-------|--------------|--------------------|--------------|--------|
| 5.1 | 100 | `agent-threat-model` | Name the main agent threats with an example of each. | figure | on staging |
| 5.2 | 200 | `agent-identity-and-access` | Explain what Agent Identity provides over a shared service account. | figure | on staging |
| 5.3 | 300 | `agent-auth-oauth` | Distinguish OAuth 2.0 (authorisation) from OpenID Connect (authentication). | figure | on staging |
| 5.4 | 300 | `agent-gateway-and-registry` | Explain what Agent Gateway enforces and observes. | figure | on staging |
| 5.5 | 400 | `guardrails-model-armor-hitl` | Configure Model Armor templates, floor settings and enforcement. | figure + codelab | on staging |

### Core: capstone (comes last)
*The core track's L400 topic. It sits at the end of the path because it needs every section.*

| ID | Level | Topic (`id`) | One-line objective | Visual / lab | Status |
|----|-------|--------------|--------------------|--------------|--------|
| 0.5 | 400 | `capstone-agent-design-review` | Produce an end-to-end design that names and justifies each choice. | figure + codelab | plan-approved |

### Track × level matrix

| Track | L100 | L200 | L300 | L400 |
|---|---|---|---|---|
| Core | 0.1, 0.2 | 0.3 | 0.4 | 0.5 |
| S1 Low-code agents | 1.1 | 1.2, 1.3 | — | — |
| S2 Coding agents | 2.1 | 2.2 | 2.3 | 2.4 |
| S3 Custom agents | 3.1 | 3.2, 3.3 | 3.4, 3.5, 3.6 | 3.7, 3.8 |
| S4 Evaluate and deploy | 4.1 | 4.2, 4.3 | 4.4 | 4.5 |
| S5 Secure and govern | 5.1 | 5.2 | 5.3, 5.4 | 5.5 |

30 topics, about 13 hours. Gaps are deliberate: S1 stops at L200 (it is the lightest section, and its design question is core 0.4); S3 starts at L100 with the agent loop and runs to L400.

### How it maps to `paths/gcp-agentic-architect.mdx`
The path schema allows the same `level` number in several blocks, so each track and level becomes one block in this order, titled by track:

```yaml
levels:
  - level: 100
    title: "Core · understand"
    topics: [agentic-ai/what-is-an-agent, agentic-ai/google-agent-platform-map]
  - level: 200
    title: "Core · configure and build"
    topics: [agentic-ai/choosing-a-model]
  - level: 300
    title: "Core · design and integrate"
    topics: [agentic-ai/low-code-or-code]
  - level: 100
    title: "S1: Low-code agents · understand"
    topics: [agentic-ai/workflow-builder]
  - level: 200
    title: "S1: Low-code agents · configure and build"
    topics: [agentic-ai/cx-agent-studio-flows, agentic-ai/enterprise-data-gemini-enterprise]
  - level: 100
    title: "S2: Coding agents · understand"
    topics: [agentic-ai/configuring-coding-agents]
  - level: 200
    title: "S2: Coding agents · configure and build"
    topics: [agentic-ai/customizing-coding-agents]
  - level: 300
    title: "S2: Coding agents · design and integrate"
    topics: [agentic-ai/agents-cli]
  - level: 400
    title: "S2: Coding agents · operate and harden"
    topics: [agentic-ai/coding-agent-sandboxes]
  - level: 100
    title: "S3: Custom agents · understand"
    topics: [agentic-ai/the-agent-loop]
  - level: 200
    title: "S3: Custom agents · configure and build"
    topics: [agentic-ai/adk-agents-and-tools, agentic-ai/sessions-state-memory]
  - level: 300
    title: "S3: Custom agents · design and integrate"
    topics: [agentic-ai/rag-pipelines, agentic-ai/mcp-tools-and-integrations, agentic-ai/a2a-and-mcp]
  - level: 400
    title: "S3: Custom agents · operate and harden"
    topics: [agentic-ai/multi-agent-orchestration, agentic-ai/context-engineering]
  - level: 100
    title: "S4: Evaluate and deploy · understand"
    topics: [agentic-ai/agent-quality-basics]
  - level: 200
    title: "S4: Evaluate and deploy · configure and build"
    topics: [agentic-ai/agent-eval-datasets, agentic-ai/deploying-agents]
  - level: 300
    title: "S4: Evaluate and deploy · design and integrate"
    topics: [agentic-ai/agent-eval-criteria]
  - level: 400
    title: "S4: Evaluate and deploy · operate and harden"
    topics: [agentic-ai/agent-observability-troubleshooting]
  - level: 100
    title: "S5: Secure and govern · understand"
    topics: [agentic-ai/agent-threat-model]
  - level: 200
    title: "S5: Secure and govern · configure and build"
    topics: [agentic-ai/agent-identity-and-access]
  - level: 300
    title: "S5: Secure and govern · design and integrate"
    topics: [agentic-ai/agent-auth-oauth, agentic-ai/agent-gateway-and-registry]
  - level: 400
    title: "S5: Secure and govern · operate and harden"
    topics: [agentic-ai/guardrails-model-armor-hitl]
  - level: 400
    title: "Core · capstone"
    topics: [agentic-ai/capstone-agent-design-review]
```

## Supporting content (built with the topics, not before)
- **Glossary** `glossary/gcp-agentic-architect.json`: each term is added by the topic that introduces it. The draft glossary in the exam-prep kit (359 terms) is source material, re-checked before reuse.
- **Resources** `resources/gcp-agentic-architect.json`: exam guide, official learning path, ADK docs, codelabs.
- **Knowledge records** under `knowledge/`: one per product fact a lesson relies on (names, launch stages, limits, defaults). Each topic plan lists the records it needs.
- **Simulations (5):** `agent-loop-stepper`, `cx-route-resolver`, `rag-retrieval-tuner`, `orchestration-patterns`, `trajectory-match-explorer`.

## Unofficial input (test-taker reports)
A third-party summary of beta-exam write-ups (Grok Bot page "Agentic Architect
Exam: What to Study First", read 2026-11-15 through the exam-prep kit) shaped
these choices. It is not authoritative. Every lesson claim comes from Google's
docs, and the official exam guide decides what is in scope.
- Format: about 75 questions, choose 1 of 4 or 2 of 5, 2 hours, and **two
  hands-on Google Skills labs** within 2 months. So 1.1, 2.1, 3.2, 4.2, 5.5 and the 0.5
  capstone each link a codelab, and the ADK topics aim at building one small end-to-end agent.
- One tester felt sections 3 and 4 were heavier and section 1 lighter than the
  official weights. The map keeps section 1 to 3 topics (plus core 0.4) and gives section 3 eight.
- IAM, OAuth (2LO vs 3LO, OIDC) and Agent Gateway felt harder than their 15%. Hence
  a security track that runs L100 to L400, with a separate OAuth topic (5.3).
- "Use a model-based judge when you need to check which tools ran, in what order,
  under whose identity" is a trap: 4.4's sim and quiz are built around it.
- "Grounded but wrong" (retrieval fetched an outdated document) is a 3.4 must-learn.
- Decision axes (how much determinism, local vs cloud vs managed, and Agent Runtime,
  Cloud Run and GKE as substitutes while MCP tools are a complement) recur as the
  "decision" each topic is built around.

## Decisions
Items 1 to 4 and 6 were signed off as recommended on 2026-11-17. Items 5 and 7 stay open as follow-ups.

1. ✅ **Multi-select questions.** The exam has "choose 2 of 5" items, but `QuizItemSchema` allows one answer. Recommendation: lesson quizzes stay single-answer (they test the lesson, not the exam format), and a schema change for multi-select is a separate, `risk:high` proposal if wanted later.
2. ✅ **Practice exam.** The path has no practice exam. The exam-prep app in the project files does that job; this path should not copy its question bank. The path stops at lessons plus quizzes.
3. ✅ **Preview features.** Many in-scope features are Preview, and their stages conflict across pages (see the exam-prep blueprint's open questions). Lessons state the stage with a dated knowledge record and avoid exact role names and CLI flags until verified.
4. ✅ **ADK workflow agents.** Sequential/Parallel/Loop template agents are marked deprecated in favour of graph workflows in most ADK languages. Plan 3.7 teaches the patterns, with graph workflows as the current way.
5. ⏳ **Audience reviewer.** An audience persona (a cloud architect new to agents) would let the audience-reviewer subagent check each lesson. Proposed as a follow-up, not part of this PR.
6. ✅ **Subject-first order.** The path runs core, then S1 to S5, each from L100 to L400 (levels are depth within a subject). Two consequences to accept: core 0.4 (low-code or code) is taught as a decision framework before S1 and S3 go deep on each side, and the core capstone (0.5) sits at the very end.
7. ⏳ **LMS needs unique level keys before this path ships.** The schema allows repeated `level` numbers, but the app's path page (`LMS` `app/paths/[id]/page.tsx`) keys each section by `lvl.level`, so 22 blocks with four distinct numbers collide (duplicate React keys) and the badge would read "22 levels". Before `paths/gcp-agentic-architect.mdx` is published, LMS needs a unique key (for example level plus title, or the array index) and a badge that counts distinct levels or tracks. Raised in review on this PR; it is an LMS change, not a content change.
