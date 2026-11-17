---
id: concept/agent-evalset
type: concept
status: proposed
title: "An agent eval case records the expected path as well as the expected reply"
scope: "Golden datasets for LLM agents in ADK (Python): test files, evalsets and user simulation, as documented on 2026-11-17. The case-mix guidance (happy, edge, adversarial) is this path's teaching framing"
sources:
  - "ADK documentation, \"Why evaluate agents\", github.com/google/adk-docs/blob/main/docs/evaluate/index.md (retrieved 2026-11-17: test files hold one session for unit-style checks; evalsets hold multiple, potentially lengthy sessions for integration tests; each turn records user content, expected tool use trajectory, expected intermediate responses and the final response; each eval has an initial session state; capture with the web UI's Eval tab, Add current session)"
  - "ADK documentation, \"User simulation\", github.com/google/adk-docs/blob/main/docs/evaluate/user-sim.md (retrieved 2026-11-17: ConversationScenario with starting_prompt, conversation_plan and optional user_persona; a model generates user prompts dynamically)"
  - "ADK documentation, \"Evaluation criteria\", github.com/google/adk-docs/blob/main/docs/evaluate/criteria.md (retrieved 2026-11-17: match types EXACT, IN_ORDER and ANY_ORDER, with EXACT the default; the per-criterion Supports User Simulation column; tool_trajectory_avg_score, response_match_score and final_response_match_v2 do not)"
touches:
  - agentic-ai/agent-eval-datasets
tags: [agents, evaluation, adk]
terms: [golden dataset, evalset, test file, eval case, user simulation, conversation scenario]
related: [concept/agent-quality-dimensions, claim/adk-built-in-eval-criteria]
provenance:
  origin: authoring
  by: agent:claude
  from: "planning/gcp-agentic-architect/topics/4.2-agent-eval-datasets.md"
reviewed: 2026-11-17
review-by: 2027-02-15
---

**Concept.** A golden dataset is a fixed set of cases, each with the outputs you would accept, that you run on every version of an agent so scores are comparable. In ADK each case is a session with a stated session input (app name, user id, initial state), with one or more turns; each turn records the user's input, the **expected tool trajectory** (tool names and arguments, in order), any expected intermediate responses (from sub-agents) and the expected final response. Recording the trajectory is what makes it an agent case: a reply can match the reference while the path was wrong.

**Formats.** A test file (`*.test.json`) holds one session, possibly multi-turn, for fast unit-style checks during development. An evalset holds many sessions, each with its own id and initial state, for integration tests run less often. User simulation replaces fixed user turns with a model that follows a starting prompt, a conversation plan and optionally a persona, for conversations that can branch; criteria that compare against an expected reply or trajectory (`tool_trajectory_avg_score`, `response_match_score`, `final_response_match_v2`) are not supported with it.

**Case mix.** Happy paths, edge cases (missing or ambiguous input, limits, tool errors) and adversarial cases (attempts to break rules). For edge and adversarial cases the case often has to forbid an action: leaving the call out of the expected trajectory does that only under `EXACT` trajectory matching (ADK's default), and under the looser `IN_ORDER` or `ANY_ORDER` matches it needs a rubric instead.

**Canonical terms.** golden dataset, eval case, evalset, test file, expected trajectory, user simulation, conversation scenario.
