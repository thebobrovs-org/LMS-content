---
id: decision/simulation-serves-an-objective
type: decision
status: approved
title: "A simulation serves an objective; it is not mandatory"
scope: "Every lesson"
sources:
  - "Team decision, LMS-content#86 (learning roadmap review F10)"
touches: [math-infra/precision-and-memory, math-infra/tensor-shapes, ml-systems/jax-xla-stack]
reviewed: 2026-09-12
provenance:
  origin: review
  by: human
  from: "LMS-content#86"
review-by: 2027-09-12
---

**Decision.** A simulation is included when it serves a stated learning objective and the concept is dynamic or hard to picture. It is not the mandatory centrepiece of a lesson; a figure or a worked example is the right choice when it teaches the objective better.

**Alternatives considered.** "The simulation is the centerpiece" (the rule in the audit checklist and the SME pipeline until 2026-09-12): it made simulations production overhead for concepts a static figure explains, and it contradicted the path blueprint's own "Simulation?" decision step.

**Why.** Evidence for simulation-based learning is strongest with guidance and explanation attached (Chernikova et al., 2020), and a simulation a learner only manipulates is participation, not understanding (Chi and Wylie, 2014). The objective decides the medium.

**Consequences.** `pipeline/AUDIT.md` pedagogy and `skills/sme-content-pipeline/SKILL.md` say so; the blueprint's decision step is the place the choice is recorded per topic; a lesson without a simulation passes review when its figure or worked example serves the objective.
