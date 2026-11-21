/**
 * The content schema: every shape the LMS app reads, in one place (ADR 0001 in
 * thebobrovs-org/hyperstack, LMS-content#73). Content CI validates with it, the
 * app build imports it from the fetched content, and the admin editor from its
 * pinned copy. Change a shape here, and bump SCHEMA_VERSION when a consumer
 * would need to change too.
 *
 * Every object is strict: a key the app doesn't read is an error, so a typo
 * can't pass as an optional field. `id` is never in a file's frontmatter: the
 * app derives a topic's id from its path, and a frontmatter id would override it.
 */
import { z } from "zod";

/** Bump when a change here needs a consumer change. Consumers check it at build. */
export const SCHEMA_VERSION = 2;

const nonEmpty = z.string().min(1, "must not be empty");
/** An id in the content tree: kebab-case segments, `dir/name` for a topic. */
export const ContentIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/, "must be kebab-case segments separated by /");

/** Whether `YYYY-MM-DD` names a real calendar day (leap years included). */
export function isCalendarDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // setUTCFullYear keeps a literal year: Date.UTC would read 0099 as 1999.
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d);
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** A YAML date must be quoted: an unquoted `2026-09-11` parses as a Date, which the app can't render. */
const IsoDate = z
  // A missing value keeps the default message (`error` returns undefined), as invalid_type_error did in zod 3.
  .string({ error: (iss) => (iss.input === undefined ? undefined : "must be a quoted YYYY-MM-DD string (an unquoted date parses as a Date)") })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a quoted YYYY-MM-DD string")
  .refine(isCalendarDate, "must be a real calendar date");

/** A video timestamp, `m:ss` or `h:mm:ss`, quoted in YAML (an unquoted `2:25` can parse as a sexagesimal number). */
export const TimestampSchema = z
  .string({ error: (iss) => (iss.input === undefined ? undefined : 'must be a quoted "m:ss" or "h:mm:ss" string') })
  .regex(/^(?:\d+:)?[0-5]?\d:[0-5]\d$/, 'must be "m:ss" or "h:mm:ss"');

/** Seconds in a TimestampSchema string: `"1:02:03"` is 3723. */
export function timestampSeconds(t) {
  return t.split(":").reduce((s, part) => s * 60 + Number(part), 0);
}

/** A moment in a video worth jumping to: the app renders it as a chip that starts or seeks the player there. */
export const VideoChapterSchema = z.object({ at: TimestampSchema, label: nonEmpty }).strict();

/**
 * A suggested video (a topic's `videos`): the app lists them under "Suggested videos", each a privacy-friendly
 * lazy youtube-nocookie player with its chapters as chips. Only `youtubeId` is required; `why` says what it adds
 * to the lesson and `note` is a short caveat for the learner (an older product name, a partial match).
 */
export const VideoSchema = z
  .object({
    youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, "must be an 11-character YouTube video id"),
    title: z.string().optional(),
    start: z.number().int().nonnegative().optional(),
    /** The publishing channel, as YouTube shows it. */
    channel: z.string().min(1).optional(),
    /** The video's length, as YouTube shows it. */
    duration: TimestampSchema.optional(),
    published: IsoDate.optional(),
    why: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    chapters: z.array(VideoChapterSchema).default([]),
  })
  .strict()
  .superRefine((v, ctx) => {
    const end = v.duration === undefined ? Infinity : timestampSeconds(v.duration);
    let prev = -1;
    for (const [i, c] of v.chapters.entries()) {
      const t = timestampSeconds(c.at);
      if (t <= prev) ctx.addIssue({ code: "custom", path: ["chapters", i, "at"], message: "chapters must be in increasing time order" });
      if (t >= end) ctx.addIssue({ code: "custom", path: ["chapters", i, "at"], message: `is past the video's end (${v.duration})` });
      prev = t;
    }
  });

/**
 * A learning objective's id (LMS-content#83): lowercase, digits and hyphens, unique within
 * its topic. A quiz item, a flashcard, an inline <Quiz> or a <Step> may name the objective it
 * serves with `objective`; the validator checks the reference exists.
 */
export const ObjectiveIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "an objective id is lowercase letters, digits and hyphens");

/** What a learner should be able to do after the lesson, in one observable sentence. */
export const ObjectiveSchema = z.object({ id: ObjectiveIdSchema, statement: nonEmpty }).strict();

/**
 * A stable id for a review item or a lesson step (ADR 0004): a slug, unique within
 * its topic. With an `id`, a learner's progress is keyed by it and survives a
 * rewording; without one, the app keys the item by a hash of its prompt.
 * `formerIds` are the ids (hashes included) the item had before, so the progress
 * stored under them still counts. The validator checks uniqueness and that no
 * former id is another item's; a change of meaning under the same id is the
 * assessment-validity critic's question (pipeline/AUDIT.md).
 */
export const ItemIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "an id is lowercase letters, digits and hyphens");
const identity = { id: ItemIdSchema.optional(), formerIds: z.array(ItemIdSchema).default([]) };

export const FlashcardSchema = z.object({ front: nonEmpty, back: nonEmpty, objective: ObjectiveIdSchema.optional(), ...identity }).strict();

export const QuizItemSchema = z
  .object({
    question: nonEmpty,
    choices: z.array(nonEmpty).min(2, "needs at least 2 choices"),
    answer: z.number().int().nonnegative(),
    explanation: z.string().optional(),
    objective: ObjectiveIdSchema.optional(),
    ...identity,
  })
  .strict()
  .refine((q) => q.answer < q.choices.length, { message: "answer is out of range", path: ["answer"] });

// Literal tuples (JSDoc const assertions), so the declarations keep the enum members.
export const STATUSES = /** @type {const} */ (["draft", "published"]);
export const DIFFICULTIES = /** @type {const} */ (["beginner", "intermediate", "advanced"]);

/**
 * The components an MDX lesson may use, and nothing else: the app's `mdxComponents`
 * (LMS components/mdx/mdx-components.tsx). Content CI rejects any other JSX tag,
 * and any JavaScript (expressions, imports, exports): lessons are prose plus these.
 */
export const MDX_COMPONENTS = /** @type {const} */ (["YouTube", "Callout", "Simulation", "Flashcard", "Quiz", "Steps", "Step", "Figure", "Tip", "Term", "ReadAlong"]);
/** The `type` a `<Callout>` may carry (the app's Callout component); anything else renders as a plain note. */
export const CALLOUT_TYPES = /** @type {const} */ (["tip", "note", "warning"]);

/** A topic file's frontmatter (`topics/<dir>/<name>.mdx`). The app adds `id` from the path. */
export const TopicFrontmatterSchema = z
  .object({
    title: nonEmpty,
    summary: nonEmpty,
    tags: z.array(nonEmpty).min(1, "needs at least one tag"),
    difficulty: z.enum(DIFFICULTIES),
    estimatedMinutes: z.number().int().positive(),
    /** Optional curriculum tier (100/200/300) for path grouping and badges. */
    level: z.number().int().positive().optional(),
    prerequisites: z.array(ContentIdSchema).default([]),
    relatedTo: z.array(ContentIdSchema).default([]),
    /** The lesson's learning objectives (LMS-content#83); items and steps reference them by id. Optional: the app ignores them until a consumer exists. */
    objectives: z
      .array(ObjectiveSchema)
      .default([])
      .refine((list) => new Set(list.map((o) => o.id)).size === list.length, { message: "objective ids must be unique within the topic" }),
    videos: z.array(VideoSchema).default([]),
    flashcards: z.array(FlashcardSchema).default([]),
    quiz: z.array(QuizItemSchema).default([]),
    status: z.enum(STATUSES).default("published"),
    updated: IsoDate.optional(),
    authors: z.array(nonEmpty).default([]),
  })
  .strict()
  // Stable ids (ADR 0004): the frontmatter's flashcards and quiz items share one namespace, so a
  // duplicate id, or a former id that is another item's id, is refused here, where every consumer
  // of the schema (content CI, the app build, the admin editor) sees it with the item named. The
  // body's items and the prompt hashes are the validator's (pipeline/validate.mjs).
  .superRefine((t, ctx) => {
    const items = [...t.flashcards.map((f, i) => ({ path: ["flashcards", i], ...f })), ...t.quiz.map((q, i) => ({ path: ["quiz", i], ...q }))];
    const owners = new Map();
    for (const it of items) {
      if (it.id === undefined) continue;
      const other = owners.get(it.id);
      if (other) ctx.addIssue({ code: "custom", path: [...it.path, "id"], message: `id "${it.id}" is also ${other.path[0]}[${other.path[1]}]'s` });
      else owners.set(it.id, it);
    }
    for (const it of items) {
      for (const [j, f] of it.formerIds.entries()) {
        const owner = owners.get(f);
        if (f === it.id) ctx.addIssue({ code: "custom", path: [...it.path, "formerIds", j], message: `former id "${f}" is its own id` });
        else if (owner) ctx.addIssue({ code: "custom", path: [...it.path, "formerIds", j], message: `former id "${f}" is ${owner.path[0]}[${owner.path[1]}]'s current id` });
      }
    }
  });

/** How a path's sections are presented (PathFrontmatterSchema.layout). */
export const PATH_LAYOUTS = /** @type {const} */ (["levels", "chapters"]);

export const PathLevelSchema = z
  .object({
    level: z.number().int().positive(),
    title: nonEmpty,
    topics: z.array(ContentIdSchema).min(1, "needs at least one topic"),
  })
  .strict();

/** A path file's frontmatter (`paths/<id>.mdx`). The app adds `id` from the file name. */
export const PathFrontmatterSchema = z
  .object({
    title: nonEmpty,
    summary: nonEmpty,
    levels: z.array(PathLevelSchema).min(1, "needs at least one level"),
    /**
     * How the app presents the path's sections. "levels" (the default): each section is a depth tier and
     * shows its `level` (100, 200, …). "chapters": each section is a chapter, numbered by its place in the
     * list, and `level` is only that number; the app shows no levels. Optional and ignorable: an app that
     * doesn't know it still renders every section in order.
     */
    layout: z.enum(PATH_LAYOUTS).default("levels"),
    status: z.enum(STATUSES).default("published"),
  })
  .strict()
  // In a chapters path a section's `level` is its chapter number, so it must match its place: 1, 2, 3, …
  .superRefine((p, ctx) => {
    if (p.layout !== "chapters") return;
    for (const [i, l] of p.levels.entries()) {
      if (l.level !== i + 1) ctx.addIssue({ code: "custom", path: ["levels", i, "level"], message: `is chapter ${i + 1} in a chapters path, so its level must be ${i + 1}` });
    }
  });

/** `glossary/<pathId>.json`: term → entry. */
export const GlossaryEntrySchema = z
  .object({
    definition: nonEmpty,
    href: z.string().url().optional(),
    linkLabel: nonEmpty.optional(),
  })
  .strict();
export const GlossarySchema = z.record(nonEmpty, GlossaryEntrySchema);

/** `resources/<pathId>.json`: a list of supplementary items, each of one type. */
const resourceBase = { title: nonEmpty, topic: ContentIdSchema.optional() };
export const ResourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("video"), ...resourceBase, youtubeId: nonEmpty, start: z.number().int().nonnegative().optional() }).strict(),
  z.object({ type: z.literal("prompt"), ...resourceBase, prompt: nonEmpty }).strict(),
  z.object({ type: z.literal("notebook"), ...resourceBase, url: z.string().url(), note: z.string().optional() }).strict(),
  z.object({ type: z.literal("link"), ...resourceBase, url: z.string().url(), note: z.string().optional() }).strict(),
]);
export const ResourcesSchema = z.array(ResourceSchema);

/** `simulations/packages/<id>/sim.config.json`. `id` must equal the directory name (content CI checks). */
export const SimCheckpointSchema = z
  .object({
    id: nonEmpty,
    hint: z.string().optional(),
    /** Ids this checkpoint had before (LMS#62): a learner who completed one of them keeps that progress. Distinct from `id` and from each other. */
    renamedFrom: z.array(nonEmpty).optional(),
  })
  .strict()
  .refine((c) => !c.renamedFrom || (!c.renamedFrom.includes(c.id) && new Set(c.renamedFrom).size === c.renamedFrom.length), {
    message: "renamedFrom lists former ids: not the current id, and no duplicates",
    path: ["renamedFrom"],
  });
export const SimConfigSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case"),
    title: nonEmpty,
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be MAJOR.MINOR.PATCH"),
    props: z.record(z.string(), z.unknown()).default({}),
    checkpoints: z.array(SimCheckpointSchema).default([]),
  })
  .strict();

/** One sentence of a `<ReadAlong>`: its span in the MP3 in seconds, its text, and the paragraph it belongs to. */
export const ReadAlongCueSchema = z
  .object({
    start: z.number().finite().nonnegative(),
    end: z.number().finite().nonnegative(),
    text: nonEmpty,
    paragraph: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine((c) => c.end >= c.start, { message: "end must not be before start", path: ["end"] });
/**
 * `audio/<topic id>.json`: a lesson's narration, which a prop-less `<ReadAlong />` in that lesson
 * renders. Written by scripts/generate-readalong.mjs (and its workflow), never by hand: `textHash`
 * is the SHA-256 of the narration text the MP3 was made from, so content CI can tell when the
 * lesson's prose has moved on, and the generator can skip a lesson whose text hasn't.
 */
export const ReadAlongAudioSchema = z
  .object({
    src: z.string().regex(/^(?:https:\/\/[^\s]+|\/media\/[^\s]+)$/, "must be an https URL or a /media/ path"),
    voice: nonEmpty,
    model: nonEmpty,
    textHash: z.string().regex(/^[0-9a-f]{64}$/, "must be a SHA-256 hex digest"),
    cues: z.array(ReadAlongCueSchema).min(1),
  })
  .strict()
  .refine((a) => a.cues.every((c, i) => i === 0 || c.start >= a.cues[i - 1].start), { message: "cues must be sorted by start", path: ["cues"] });

/**
 * Validate `value` against `schema`, naming `file`: the parsed value (the schema's
 * output type, with defaults filled in), or a list of problems as
 * "file: path: message" lines. Never throws: a refinement or transform that
 * throws is reported as a problem too.
 * @template {z.ZodTypeAny} S
 * @param {S} schema
 * @param {unknown} value
 * @param {string} [file]
 * @returns {{ ok: true, value: z.output<S>, problems: string[] } | { ok: false, value: null, problems: string[] }}
 */
export function check(schema, value, file = "(input)") {
  let r;
  try {
    r = schema.safeParse(value);
  } catch (e) {
    return { ok: false, value: null, problems: [`${file}: validation threw: ${e instanceof Error ? e.message : String(e)}`] };
  }
  if (r.success) return { ok: true, value: r.data, problems: [] };
  const problems = r.error.issues.map((i) => `${file}: ${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`);
  return { ok: false, value: null, problems };
}
