// Generated from schema/content-schema.mjs by scripts/schema-declarations.mjs. Do not edit.
/** Whether `YYYY-MM-DD` names a real calendar day (leap years included). */
export function isCalendarDate(s: any): boolean;
/** Seconds in a TimestampSchema string: `"1:02:03"` is 3723. */
export function timestampSeconds(t: any): any;
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
export function check<S extends z.ZodTypeAny>(schema: S, value: unknown, file?: string): {
    ok: true;
    value: z.output<S>;
    problems: string[];
} | {
    ok: false;
    value: null;
    problems: string[];
};
/** Bump when a change here needs a consumer change. Consumers check it at build. */
export const SCHEMA_VERSION: 2;
/** An id in the content tree: kebab-case segments, `dir/name` for a topic. */
export const ContentIdSchema: z.ZodString;
/** A video timestamp, `m:ss` or `h:mm:ss`, quoted in YAML (an unquoted `2:25` can parse as a sexagesimal number). */
export const TimestampSchema: z.ZodString;
/** A moment in a video worth jumping to: the app renders it as a chip that starts or seeks the player there. */
export const VideoChapterSchema: z.ZodObject<{
    at: z.ZodString;
    label: z.ZodString;
}, z.core.$strict>;
/**
 * A suggested video (a topic's `videos`): the app lists them under "Suggested videos", each a privacy-friendly
 * lazy youtube-nocookie player with its chapters as chips. Only `youtubeId` is required; `why` says what it adds
 * to the lesson and `note` is a short caveat for the learner (an older product name, a partial match).
 */
export const VideoSchema: z.ZodObject<{
    youtubeId: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    start: z.ZodOptional<z.ZodNumber>;
    channel: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodString>;
    published: z.ZodOptional<z.ZodString>;
    why: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    chapters: z.ZodDefault<z.ZodArray<z.ZodObject<{
        at: z.ZodString;
        label: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strict>;
/**
 * A learning objective's id (LMS-content#83): lowercase, digits and hyphens, unique within
 * its topic. A quiz item, a flashcard, an inline <Quiz> or a <Step> may name the objective it
 * serves with `objective`; the validator checks the reference exists.
 */
export const ObjectiveIdSchema: z.ZodString;
/** What a learner should be able to do after the lesson, in one observable sentence. */
export const ObjectiveSchema: z.ZodObject<{
    id: z.ZodString;
    statement: z.ZodString;
}, z.core.$strict>;
/**
 * A stable id for a review item or a lesson step (ADR 0004): a slug, unique within
 * its topic. With an `id`, a learner's progress is keyed by it and survives a
 * rewording; without one, the app keys the item by a hash of its prompt.
 * `formerIds` are the ids (hashes included) the item had before, so the progress
 * stored under them still counts. The validator checks uniqueness and that no
 * former id is another item's; a change of meaning under the same id is the
 * assessment-validity critic's question (pipeline/AUDIT.md).
 */
export const ItemIdSchema: z.ZodString;
export const FlashcardSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    formerIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    front: z.ZodString;
    back: z.ZodString;
    objective: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export const QuizItemSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    formerIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    question: z.ZodString;
    choices: z.ZodArray<z.ZodString>;
    answer: z.ZodNumber;
    explanation: z.ZodOptional<z.ZodString>;
    objective: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export const STATUSES: readonly ["draft", "published"];
export const DIFFICULTIES: readonly ["beginner", "intermediate", "advanced"];
/**
 * The components an MDX lesson may use, and nothing else: the app's `mdxComponents`
 * (LMS components/mdx/mdx-components.tsx). Content CI rejects any other JSX tag,
 * and any JavaScript (expressions, imports, exports): lessons are prose plus these.
 */
export const MDX_COMPONENTS: readonly ["YouTube", "Callout", "Simulation", "Flashcard", "Quiz", "Steps", "Step", "Figure", "Tip", "Term", "ReadAlong"];
/** The `type` a `<Callout>` may carry (the app's Callout component); anything else renders as a plain note. */
export const CALLOUT_TYPES: readonly ["tip", "note", "warning"];
/** A topic file's frontmatter (`topics/<dir>/<name>.mdx`). The app adds `id` from the path. */
export const TopicFrontmatterSchema: z.ZodObject<{
    title: z.ZodString;
    summary: z.ZodString;
    tags: z.ZodArray<z.ZodString>;
    difficulty: z.ZodEnum<{
        beginner: "beginner";
        intermediate: "intermediate";
        advanced: "advanced";
    }>;
    estimatedMinutes: z.ZodNumber;
    level: z.ZodOptional<z.ZodNumber>;
    prerequisites: z.ZodDefault<z.ZodArray<z.ZodString>>;
    relatedTo: z.ZodDefault<z.ZodArray<z.ZodString>>;
    objectives: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        statement: z.ZodString;
    }, z.core.$strict>>>;
    videos: z.ZodDefault<z.ZodArray<z.ZodObject<{
        youtubeId: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        start: z.ZodOptional<z.ZodNumber>;
        channel: z.ZodOptional<z.ZodString>;
        duration: z.ZodOptional<z.ZodString>;
        published: z.ZodOptional<z.ZodString>;
        why: z.ZodOptional<z.ZodString>;
        note: z.ZodOptional<z.ZodString>;
        chapters: z.ZodDefault<z.ZodArray<z.ZodObject<{
            at: z.ZodString;
            label: z.ZodString;
        }, z.core.$strict>>>;
    }, z.core.$strict>>>;
    flashcards: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        formerIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        front: z.ZodString;
        back: z.ZodString;
        objective: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
    quiz: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        formerIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
        question: z.ZodString;
        choices: z.ZodArray<z.ZodString>;
        answer: z.ZodNumber;
        explanation: z.ZodOptional<z.ZodString>;
        objective: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
    status: z.ZodDefault<z.ZodEnum<{
        published: "published";
        draft: "draft";
    }>>;
    updated: z.ZodOptional<z.ZodString>;
    authors: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strict>;
/** How a path's sections are presented (PathFrontmatterSchema.layout). */
export const PATH_LAYOUTS: readonly ["levels", "chapters"];
export const PathLevelSchema: z.ZodObject<{
    level: z.ZodNumber;
    title: z.ZodString;
    topics: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
/** A path file's frontmatter (`paths/<id>.mdx`). The app adds `id` from the file name. */
export const PathFrontmatterSchema: z.ZodObject<{
    title: z.ZodString;
    summary: z.ZodString;
    levels: z.ZodArray<z.ZodObject<{
        level: z.ZodNumber;
        title: z.ZodString;
        topics: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    layout: z.ZodDefault<z.ZodEnum<{
        chapters: "chapters";
        levels: "levels";
    }>>;
    status: z.ZodDefault<z.ZodEnum<{
        published: "published";
        draft: "draft";
    }>>;
}, z.core.$strict>;
/** `glossary/<pathId>.json`: term → entry. */
export const GlossaryEntrySchema: z.ZodObject<{
    definition: z.ZodString;
    href: z.ZodOptional<z.ZodString>;
    linkLabel: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export const GlossarySchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    definition: z.ZodString;
    href: z.ZodOptional<z.ZodString>;
    linkLabel: z.ZodOptional<z.ZodString>;
}, z.core.$strict>>;
export const ResourceSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    youtubeId: z.ZodString;
    start: z.ZodOptional<z.ZodNumber>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"video">;
}, z.core.$strict>, z.ZodObject<{
    prompt: z.ZodString;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"prompt">;
}, z.core.$strict>, z.ZodObject<{
    url: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"notebook">;
}, z.core.$strict>, z.ZodObject<{
    url: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"link">;
}, z.core.$strict>], "type">;
export const ResourcesSchema: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
    youtubeId: z.ZodString;
    start: z.ZodOptional<z.ZodNumber>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"video">;
}, z.core.$strict>, z.ZodObject<{
    prompt: z.ZodString;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"prompt">;
}, z.core.$strict>, z.ZodObject<{
    url: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"notebook">;
}, z.core.$strict>, z.ZodObject<{
    url: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"link">;
}, z.core.$strict>], "type">>;
/** `simulations/packages/<id>/sim.config.json`. `id` must equal the directory name (content CI checks). */
export const SimCheckpointSchema: z.ZodObject<{
    id: z.ZodString;
    hint: z.ZodOptional<z.ZodString>;
    renamedFrom: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strict>;
export const SimConfigSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    version: z.ZodString;
    props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    checkpoints: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        hint: z.ZodOptional<z.ZodString>;
        renamedFrom: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
/** One sentence of a `<ReadAlong>`: its span in the MP3 in seconds, its text, and the paragraph it belongs to. */
export const ReadAlongCueSchema: z.ZodObject<{
    start: z.ZodNumber;
    end: z.ZodNumber;
    text: z.ZodString;
    paragraph: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * `audio/<topic id>.json`: a lesson's narration, which a prop-less `<ReadAlong />` in that lesson
 * renders. Written by scripts/generate-readalong.mjs (and its workflow), never by hand: `textHash`
 * is the SHA-256 of the narration text the MP3 was made from, so content CI can tell when the
 * lesson's prose has moved on, and the generator can skip a lesson whose text hasn't.
 */
export const ReadAlongAudioSchema: z.ZodObject<{
    src: z.ZodString;
    voice: z.ZodString;
    model: z.ZodString;
    textHash: z.ZodString;
    cues: z.ZodArray<z.ZodObject<{
        start: z.ZodNumber;
        end: z.ZodNumber;
        text: z.ZodString;
        paragraph: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
import { z } from "zod";
