# Simulation briefs

The backlog of sims for the agentic architect path, one brief each. Codex, agy and Claude
pick from it in parallel; the workflow (claiming, branches, previews, cross-review) is in
[`skills/lms-authoring-simulations/SKILL.md`](../skills/lms-authoring-simulations/SKILL.md#three-agents-one-backlog).

A brief says **what** the learner must get, not how to draw it. The picture is yours:
propose it in the concept note. The facts in each brief come from its lesson; check every
product claim against the lesson's sources (and the live Google docs, with the date) before
you build, and mark scripted numbers as illustrative.

The picture is yours; the look is not. Every sim starts its `style.css` with the shared kit
and follows ["One visual style"](../skills/lms-authoring-simulations/SKILL.md#one-visual-style),
so the path reads as one set of sims, not fourteen styles.

## Status

Update your row in your own PR. Statuses: `open` → `concept` → `building` → `preview` → `review` → `merged`.

| Id | Sim | Lesson | Status | Owner | PR |
|---|---|---|---|---|---|
| B01 | Point of no return (redesign of `approval-gate-explorer`) | guardrails-model-armor-hitl | merged | claude | #193 |
| B02 | The agent's building (redesign of `state-scope-explorer`) | sessions-state-memory | merged | claude | #198 |
| B03 | Pack the backpack, keep the gems (redesign of `context-budget-explorer`) | context-engineering | merged | claude | #199 |
| B04 | Rails or a driver (redesign of `workflow-vs-agent-stepper`) | what-is-an-agent | merged | claude | #200 |
| B05 | Media by reference | context-engineering | merged | codex | #195 |
| B06 | Grounded but wrong: retrieval precision and recall (upgrade of `rag-retrieval-tuner`) | rag-pipelines | review | claude | #204 |
| B07 | Least privilege and the access boundary | agent-identity-and-access | merged | codex | #197 |
| B08 | Whose authority: the 3-legged OAuth pause | agent-auth-oauth | open | | |
| B09 | Hook pipeline | customizing-coding-agents | open | | |
| B10 | What each guardrail can see | guardrails-model-armor-hitl | concept | codex | #206 |
| B11 | Scaling and cost | deploying-agents | open | | |
| B12 | Trace detective | agent-observability-troubleshooting | open | | |
| B13 | Requirements to a model | choosing-a-model | open | | |
| B14 | Low-code or code pressure test | low-code-or-code | open | | |

B02 to B04 have approved concepts (Claude's concept note, 17 Nov 2026). B05 to B14 come from
the interactive-opportunities audit of 17 Nov 2026 (its top 10) and still need a concept note.

---

## B01. Point of no return

Done: see `approval-gate-explorer` and #193. Kept here as the worked example of a brief.

- **Lesson:** `topics/agentic-ai/guardrails-model-armor-hitl.mdx`, "Try it: can a denial stop a refund that already ran?"
- **Objective:** Given an irreversible tool, the learner can say where the approval has to sit and why.
- **Aha:** A denial only helps before the side effect; after it, the money has already moved.
- **Misconception:** "A review step anywhere in the flow protects me."
- **Checkpoint:** `observe-approval-before-side-effect` (kept).

## B02. The agent's building

- **Lesson:** `topics/agentic-ai/sessions-state-memory.mdx`, "Try it: which values survive a new session?"
- **Objective:** Given a value, the learner can choose `temp:`, no prefix, `user:` or `app:`, and say that surviving a restart depends on the session service.
- **Focus:** who reads a key (scope) versus whether it survives a restart (service), shown as two separate questions.
- **Aha:** A `user:` key follows the user into a new session; a key with no prefix stays behind in the old one.
- **Misconception:** "The prefix decides whether a value survives a restart."
- **Checkpoint:** `observe-user-scope` (kept).
- **Sources:** the lesson's ADK state documentation references.

## B03. Pack the backpack, keep the gems

- **Lesson:** `topics/agentic-ai/context-engineering.mdx`, the sim section (line ~486).
- **Objective:** Given a 47,000-token late turn, the learner can cut it to about 20,000 with `tool_filter`, compaction, `load_memory` and reranking, without losing the evidence the evalset needs.
- **Focus:** each cut can drop a "gem" (the order id in history, the `check_warranty` declaration, the return-policy fact in chunk 7); caching makes tokens cheaper, not fewer.
- **Aha:** A lean context that drops the evidence fails the evalset; pinning the order id in state and reranking keep it.
- **Misconception:** "Fewer tokens is always better" and "caching shrinks the context."
- **Checkpoint:** `observe-evidence-survives` (kept).
- **Sources:** the lesson's numbers (illustrative) and its Gemini pricing source with date.
- **Note:** the lesson also shows `context-budget.svg`, which tells the same story; retire one in this PR.

## B04. Rails or a driver

- **Lesson:** `topics/agentic-ai/what-is-an-agent.mdx`, the sim section (line ~172).
- **Objective:** Given a scenario, the learner can pick the least autonomy that solves it and name what autonomy costs.
- **Focus:** the same order-support request on a fixed workflow and on an agent, with an expected and an unexpected (partly shipped) tool result; count model calls.
- **Aha:** On the expected path both reach the same outcome and the workflow is cheaper; on the surprise the workflow falls to its "anything else" branch while the agent picks a step nobody wired.
- **Misconception:** "An agent is always better" or "a workflow can't use a model."
- **Checkpoint:** `observe-who-decides` (kept).
- **Sources:** the lesson. The agent's choices are a scripted fixture; say so in the sim.

## B05. Media by reference

- **Lesson:** `topics/agentic-ai/context-engineering.mdx`, the media section (line ~290). Could become a panel of B03 instead of its own sim: say which in the concept note.
- **Objective:** Given large or reused images, the learner can choose a Cloud Storage URI over inline bytes and cap tokens with `media_resolution`.
- **Focus:** two separate fixes: a URI keeps bytes out of each request; `media_resolution` caps tokens per image (Gemini 3 images: low 280, medium 560, high 1,120, ultra_high 2,240).
- **Aha:** A URI shrinks the request but not the tokens; only the resolution setting shrinks the tokens.
- **Misconception:** "Passing a URI makes the image cost fewer tokens."
- **Checkpoint:** new, e.g. `observe-reference-vs-resolution`.
- **Sources:** the lesson's "Media resolution" source (Gemini API docs); check the inline request limit there too.

## B06. Grounded but wrong: precision and recall

- **Lesson:** `topics/agentic-ai/rag-pipelines.mdx`, the sim section (line ~219). Upgrade of `rag-retrieval-tuner`.
- **Objective:** Given a grounded-but-wrong answer, the learner can diagnose it with context precision and recall and fix it with a metadata filter.
- **Focus:** label the relevant chunks; show the share of top-k that is relevant (precision) and the share of relevant chunks retrieved (recall); add a predict step before Retrieve.
- **Aha:** High recall with low precision lets a superseded policy ground a faithful but wrong answer; the filter, not more chunks, fixes it.
- **Misconception:** "If the answer is grounded in retrieved text, it's right."
- **Checkpoint:** `observe-stale-grounding` (kept).
- **Note:** the lesson does not name the metrics yet; add them to the text in this PR, with a source.

## B07. Least privilege and the access boundary

- **Lesson:** `topics/agentic-ai/agent-identity-and-access.mdx`.
- **Objective:** Given an agent's tools, the learner can grant the narrowest roles on the narrowest resources and use a Principal Access Boundary to cap reach.
- **Focus:** a prompt injection tries a set of resources; the learner watches the reachable set shrink with each change. A PAB caps but never grants; a broad "debug" grant stays capped.
- **Aha:** A boundary limits what any grant can reach; it doesn't give access by itself.
- **Misconception:** "A Principal Access Boundary grants access" or "a shared service account is fine if the prompt is safe."
- **Checkpoint:** new, e.g. `observe-boundary-caps`.
- **Sources:** the lesson's IAM and PAB references; check how several PAB policies combine before showing it.

## B08. Whose authority: the 3-legged OAuth pause

- **Lesson:** `topics/agentic-ai/agent-auth-oauth.mdx`.
- **Objective:** Given a tool that acts for a user, the learner can choose user authority (3LO) over agent authority (2LO) and walk through ADK's consent pause.
- **Focus:** the run pauses with `adk_request_credential`; the client app sends the user to consent and returns the auth response; ADK exchanges the code and retries the tool call.
- **Aha:** The agent never sees the password; it waits, and the client app does the redirect.
- **Misconception:** "The agent asks the user for their credentials" or "2LO is fine for user data."
- **Checkpoint:** new, e.g. `observe-consent-pause`.
- **Sources:** the lesson's ADK authentication references.

## B09. Hook pipeline

- **Lesson:** `topics/agentic-ai/customizing-coding-agents.mdx`.
- **Objective:** Given a requirement, the learner can pick the mechanism that guarantees it, and knows what PreToolUse and PostToolUse hooks can and can't do.
- **Focus:** a tool event flows through PreToolUse (can block before it runs), the tool, PostToolUse (runs after; can't undo). A rule in an instructions file only guides.
- **Aha:** Only a hook runs on every matching event whatever the model decides, and only a PreToolUse hook can stop the call.
- **Misconception:** "A rule in the instructions file guarantees it" or "a PostToolUse hook can prevent the change."
- **Checkpoint:** new, e.g. `observe-hook-guarantee`.
- **Sources:** the lesson's references; verify what a failing or crashing hook does in each agent before you show it.

## B10. What each guardrail can see

- **Lesson:** `topics/agentic-ai/guardrails-model-armor-hitl.mdx`, the Model Armor and semantic governance sections.
- **Objective:** Given a threat, the learner can say which layer catches it: a Model Armor template (with floor settings and enforcement) or a semantic governance policy.
- **Focus:** scripted inputs (direct injection, injection in a tool result, a card number, a normal-looking `send_email` the user never asked for) through inspect-only, then inspect-and-block.
- **Aha:** A normal-looking tool call passes content filters; only checking it against the user's request catches it.
- **Misconception:** "Model Armor catches every unsafe action."
- **Checkpoint:** new, e.g. `observe-guardrail-blind-spot`.
- **Sources:** the lesson's Model Armor and semantic governance references. Results are illustrative; say so.

## B11. Scaling and cost

- **Lesson:** `topics/agentic-ai/deploying-agents.mdx`.
- **Objective:** Given a load pattern, the learner can set minimum and maximum instances and concurrency, and choose request-based or instance-based billing.
- **Focus:** spiky versus steady traffic; cold starts at min 0; idle cost at min 1; very high concurrency risks memory; steady load favours instance-based billing.
- **Aha:** Each setting trades one cost for another; there is no free setting.
- **Misconception:** "Min instances 0 is always cheapest."
- **Checkpoint:** new, e.g. `observe-scaling-trade`.
- **Sources:** the lesson's Cloud Run and Agent Runtime references. Use relative units unless the lesson gives real prices with a date.

## B12. Trace detective

- **Lesson:** `topics/agentic-ai/agent-observability-troubleshooting.mdx`.
- **Objective:** Given a slow turn, the learner can read a trace, tell a reasoning loop from a slow tool, and pick the fix for each.
- **Focus:** the lesson's trace: 13.6 s against a 4 s target; `search_flights` runs four times with the same arguments (A, a loop); `get_fare_rules` takes 6.6 s (B, a slow tool).
- **Aha:** Raising the timeout fixes neither; the loop needs a better empty-result message, the slow tool needs caching or a faster call.
- **Misconception:** "A slow turn means a slow model" or "raise the timeout."
- **Checkpoint:** new, e.g. `observe-loop-vs-slow-tool`.
- **Sources:** the lesson's figure and its tracing references.

## B13. Requirements to a model

- **Lesson:** `topics/agentic-ai/choosing-a-model.mdx`.
- **Objective:** Given requirements (latency, reasoning, holding the weights, own infrastructure, region, spiky or steady volume), the learner can choose model size, openness and serving.
- **Focus:** toggling a requirement moves the three axes and names conflicts (e.g. own infrastructure with nothing to operate).
- **Aha:** Each requirement pushes one axis; conflicts are trade-offs you must name.
- **Misconception:** "Pick the biggest model" or "open weights means self-hosted."
- **Checkpoint:** new, e.g. `observe-requirement-axes`.
- **Sources:** the lesson's table and references.

## B14. Low-code or code pressure test

- **Lesson:** `topics/agentic-ai/low-code-or-code.mdx`.
- **Objective:** Given a scenario, the learner can decide low-code, code or hybrid and name the requirement that forces it.
- **Focus:** the lesson's three scenarios (IT helpdesk stays low-code, insurance claims triage needs code, sales quotes go hybrid) and its five pressure rows.
- **Aha:** One requirement, not the whole list, usually decides; hybrid keeps the low-code front end and calls code where it must.
- **Misconception:** "Code is always more capable, so always use it."
- **Checkpoint:** new, e.g. `observe-pressure-row`.
- **Sources:** the lesson.
