// The knowledge record schema (LMS-content#105, hyperstack ADR 0005): the front matter of every
// Markdown record under knowledge/. A record is one idea with its provenance: what it touches in
// the curriculum (by stable id), where it came from, who wrote it, when it was reviewed and when
// it should be looked at again. pipeline/knowledge.mjs checks the records against it and builds
// knowledge/index.json from the approved ones. Strict objects: an unknown field is an error.
import { z } from "zod";
import { isCalendarDate } from "./content-schema.mjs";

const nonEmpty = z.string().trim().min(1, "must not be empty");
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be lowercase letters, digits and hyphens");
// YAML reads an unquoted 2026-09-12 as a Date; either form is the calendar day.
const date = z.preprocess((v) => (v instanceof Date && !Number.isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : v), z.string().refine(isCalendarDate, "must be a calendar date, YYYY-MM-DD"));

export const RECORD_TYPES = /** @type {const} */ (["claim", "misconception", "decision", "concept", "question"]);
export const RECORD_STATUSES = /** @type {const} */ (["proposed", "approved", "disputed", "superseded"]);
/** The folder each type lives in. */
export const FOLDER_OF = { claim: "claims", misconception: "misconceptions", decision: "decisions", concept: "concepts", question: "questions" };

/** `<type>/<slug>`, stable once merged. */
export const RecordIdSchema = z.string().regex(/^(claim|misconception|decision|concept|question)\/[a-z0-9]+(?:-[a-z0-9]+)*$/, "a record id is <type>/<slug>");

/**
 * What a record touches in the curriculum, by stable id:
 *   `<topicId>` or `topic:<topicId>`      a lesson
 *   `objective:<topicId>#<objectiveId>`   one of its learning objectives
 *   `item:<topicId>#<itemId>`             a review item (its id, a former id, or its prompt hash: ADR 0004)
 *   `step:<topicId>:<stepId>`             a lesson step
 *   `sim:<simId>`                         a simulation
 *   `checkpoint:<simId>/<checkpointId>`   one of its checkpoints (a former id counts)
 */
const CONTENT_ID = "[a-z0-9]+(?:-[a-z0-9]+)*(?:\\/[a-z0-9]+(?:-[a-z0-9]+)*)*";
const SLUG = "[a-z0-9][a-z0-9-]*";
export const RecordRefSchema = z.string().regex(
  new RegExp(`^(?:(?:topic:)?${CONTENT_ID}|objective:${CONTENT_ID}#${SLUG}|item:${CONTENT_ID}#${SLUG}|step:${CONTENT_ID}:${SLUG}|sim:${SLUG}|checkpoint:${SLUG}\\/${SLUG})$`),
  "a reference is a topic id, or objective:<topic>#<id>, item:<topic>#<id>, step:<topic>:<id>, sim:<id> or checkpoint:<sim>/<id>",
);

/** Where a record came from. */
export const ProvenanceSchema = z
  .object({
    origin: z.enum(["question", "authoring", "review", "promotion"]),
    /** `human`, or `agent:<name>` (agent:claude, agent:codex, agent:agy). */
    by: z.string().regex(/^(?:human|agent:[a-z0-9-]+)$/, "by is human or agent:<name>"),
    /** The model, when an agent wrote it. */
    model: nonEmpty.optional(),
    /** The question record, PR or issue it came from. */
    from: nonEmpty.optional(),
  })
  .strict();

/** `owner/repo#n` or a GitHub issue URL. */
export const IssueRefSchema = z.string().regex(/^(?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#\d+|https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/issues\/\d+)$/, "an issue is owner/repo#n or its URL");

export const RecordFrontmatterSchema = z
  .object({
    id: RecordIdSchema,
    type: z.enum(RECORD_TYPES),
    status: z.enum(RECORD_STATUSES),
    /** Shown in the index and the app; the slug, humanised, when absent. */
    title: nonEmpty.optional(),
    scope: nonEmpty,
    /** v0's single locator; kept readable. New records use `sources`. */
    source: nonEmpty.optional(),
    /** Locators: a title with a section, a URL with an anchor, a PR or issue; never just a title. */
    sources: z.array(nonEmpty).optional(),
    touches: z.array(RecordRefSchema).default([]),
    tags: z.array(slug).optional(),
    /** Other records this one builds on or corrects. */
    related: z.array(RecordIdSchema).optional(),
    provenance: ProvenanceSchema.optional(),
    reviewed: date,
    /** When to look at it again: 90 days for vendor and API facts, a year for stable concepts. */
    "review-by": date.optional(),
    /** Required when superseded: the record that replaces this one. */
    "superseded-by": RecordIdSchema.optional(),
    /** Required when a published lesson depends on a disputed record: the open issue on that lesson. */
    "disputed-by": IssueRefSchema.optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (!r.id.startsWith(`${r.type}/`)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["id"], message: `id "${r.id}" must start with "${r.type}/" (its type)` });
    if (r.status === "superseded" && !r["superseded-by"]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["superseded-by"], message: "a superseded record names the record that replaces it" });
    if (r["superseded-by"] === r.id) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["superseded-by"], message: "a record cannot supersede itself" });
    if (r["review-by"] && r["review-by"] < r.reviewed) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["review-by"], message: "review-by is before reviewed" });
  });

/** A record's source locators, whichever field carries them. */
export const sourcesOf = (r) => [...(r.sources ?? []), ...(r.source ? [r.source] : [])];

/** A title for the index: the declared one, else the slug humanised. */
export const titleOf = (r) => r.title ?? r.id.split("/")[1].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
