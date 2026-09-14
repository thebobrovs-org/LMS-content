---
id: decision/item-id-rule
type: decision
status: approved
title: "A rewording keeps the id, a change of meaning gets a new one"
scope: "Every quiz item, flashcard and lesson step"
sources:
  - "hyperstack ADR 0004 (accepted 2026-09-13), LMS-content#91"
touches: [math-infra/precision-and-memory, math-infra/tensor-shapes, ml-systems/jax-xla-stack]
reviewed: 2026-09-13
provenance:
  origin: review
  by: human
  from: "hyperstack ADR 0004"
review-by: 2027-09-13
---

**Decision.** An item's `id` names what it teaches, not how it is worded. A rewording keeps the id; a change of meaning (a different fact, a different correct answer) gets a new id, and the old one is retired rather than reused. Renaming an id lists the old one in `formerIds`, so learners' progress follows.

**Alternatives considered.** Hashing the prompt (the state before this decision): a rewording reset every learner's history for the item, while a changed answer under the same wording kept history it no longer deserved. A per-item revision number: every consumer would need revision rules; aliases express the two operations we need, rename and retire.

**Why.** Progress is a learner's record of what they demonstrated. It should survive an editor's polish and not survive a change in what the item asks.

**Consequences.** The validator refuses duplicate ids and stolen former ids, and warns when a prompt changes on an item without an id (`--base`, in content CI). Whether a change under the same id changed the meaning is the assessment-validity critic's question (`pipeline/AUDIT.md` §2).
