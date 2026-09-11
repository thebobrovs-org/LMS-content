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
export const SCHEMA_VERSION = 1;

const nonEmpty = z.string().min(1, "must not be empty");
/** An id in the content tree: kebab-case segments, `dir/name` for a topic. */
export const ContentIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/, "must be kebab-case segments separated by /");
/** A YAML date must be quoted: an unquoted `2026-09-11` parses as a Date, which the app can't render. */
const IsoDate = z
  .string({ invalid_type_error: "must be a quoted YYYY-MM-DD string (an unquoted date parses as a Date)" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a quoted YYYY-MM-DD string");

export const VideoSchema = z
  .object({
    youtubeId: nonEmpty,
    title: z.string().optional(),
    start: z.number().int().nonnegative().optional(),
  })
  .strict();

export const FlashcardSchema = z.object({ front: nonEmpty, back: nonEmpty }).strict();

export const QuizItemSchema = z
  .object({
    question: nonEmpty,
    choices: z.array(nonEmpty).min(2, "needs at least 2 choices"),
    answer: z.number().int().nonnegative(),
    explanation: z.string().optional(),
  })
  .strict()
  .refine((q) => q.answer < q.choices.length, { message: "answer is out of range", path: ["answer"] });

export const STATUSES = ["draft", "published"];
export const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

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
    videos: z.array(VideoSchema).default([]),
    flashcards: z.array(FlashcardSchema).default([]),
    quiz: z.array(QuizItemSchema).default([]),
    status: z.enum(STATUSES).default("published"),
    updated: IsoDate.optional(),
    authors: z.array(nonEmpty).default([]),
  })
  .strict();

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
    status: z.enum(STATUSES).default("published"),
  })
  .strict();

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
export const SimCheckpointSchema = z.object({ id: nonEmpty, hint: z.string().optional() }).strict();
export const SimConfigSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case"),
    title: nonEmpty,
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be MAJOR.MINOR.PATCH"),
    props: z.record(z.string(), z.unknown()).default({}),
    checkpoints: z.array(SimCheckpointSchema).default([]),
  })
  .strict();

/**
 * Validate `value` against `schema`, naming `file`: the parsed value, or a list of
 * problems as "file: path: message" lines. Never throws.
 * @template T
 * @param {z.ZodType<T>} schema
 * @param {unknown} value
 * @param {string} [file]
 * @returns {{ ok: true, value: T, problems: string[] } | { ok: false, value: null, problems: string[] }}
 */
export function check(schema, value, file = "(input)") {
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, value: r.data, problems: [] };
  const problems = r.error.issues.map((i) => `${file}: ${i.path.length ? i.path.join(".") + ": " : ""}${i.message}`);
  return { ok: false, value: null, problems };
}
