// Generated from schema/content-schema.mjs by scripts/schema-declarations.mjs. Do not edit.
/**
 * Validate `value` against `schema`, naming `file`: the parsed value, or a list of
 * problems as "file: path: message" lines. Never throws.
 * @template T
 * @param {z.ZodType<T>} schema
 * @param {unknown} value
 * @param {string} [file]
 * @returns {{ ok: true, value: T, problems: string[] } | { ok: false, value: null, problems: string[] }}
 */
export function check<T>(schema: z.ZodType<T>, value: unknown, file?: string): {
    ok: true;
    value: T;
    problems: string[];
} | {
    ok: false;
    value: null;
    problems: string[];
};
/** Bump when a change here needs a consumer change. Consumers check it at build. */
export const SCHEMA_VERSION: 1;
/** An id in the content tree: kebab-case segments, `dir/name` for a topic. */
export const ContentIdSchema: z.ZodString;
export const VideoSchema: z.ZodObject<{
    youtubeId: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    start: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    youtubeId: string;
    title?: string | undefined;
    start?: number | undefined;
}, {
    youtubeId: string;
    title?: string | undefined;
    start?: number | undefined;
}>;
export const FlashcardSchema: z.ZodObject<{
    front: z.ZodString;
    back: z.ZodString;
}, "strict", z.ZodTypeAny, {
    front: string;
    back: string;
}, {
    front: string;
    back: string;
}>;
export const QuizItemSchema: z.ZodEffects<z.ZodObject<{
    question: z.ZodString;
    choices: z.ZodArray<z.ZodString, "many">;
    answer: z.ZodNumber;
    explanation: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    question: string;
    choices: string[];
    answer: number;
    explanation?: string | undefined;
}, {
    question: string;
    choices: string[];
    answer: number;
    explanation?: string | undefined;
}>, {
    question: string;
    choices: string[];
    answer: number;
    explanation?: string | undefined;
}, {
    question: string;
    choices: string[];
    answer: number;
    explanation?: string | undefined;
}>;
export const STATUSES: string[];
export const DIFFICULTIES: string[];
/** A topic file's frontmatter (`topics/<dir>/<name>.mdx`). The app adds `id` from the path. */
export const TopicFrontmatterSchema: z.ZodObject<{
    title: z.ZodString;
    summary: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    difficulty: z.ZodEnum<[string, ...string[]]>;
    estimatedMinutes: z.ZodNumber;
    /** Optional curriculum tier (100/200/300) for path grouping and badges. */
    level: z.ZodOptional<z.ZodNumber>;
    prerequisites: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    relatedTo: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    videos: z.ZodDefault<z.ZodArray<z.ZodObject<{
        youtubeId: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        start: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        youtubeId: string;
        title?: string | undefined;
        start?: number | undefined;
    }, {
        youtubeId: string;
        title?: string | undefined;
        start?: number | undefined;
    }>, "many">>;
    flashcards: z.ZodDefault<z.ZodArray<z.ZodObject<{
        front: z.ZodString;
        back: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        front: string;
        back: string;
    }, {
        front: string;
        back: string;
    }>, "many">>;
    quiz: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
        question: z.ZodString;
        choices: z.ZodArray<z.ZodString, "many">;
        answer: z.ZodNumber;
        explanation: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        question: string;
        choices: string[];
        answer: number;
        explanation?: string | undefined;
    }, {
        question: string;
        choices: string[];
        answer: number;
        explanation?: string | undefined;
    }>, {
        question: string;
        choices: string[];
        answer: number;
        explanation?: string | undefined;
    }, {
        question: string;
        choices: string[];
        answer: number;
        explanation?: string | undefined;
    }>, "many">>;
    status: z.ZodDefault<z.ZodEnum<[string, ...string[]]>>;
    updated: z.ZodOptional<z.ZodString>;
    authors: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    title: string;
    status: string;
    summary: string;
    tags: string[];
    difficulty: string;
    estimatedMinutes: number;
    prerequisites: string[];
    relatedTo: string[];
    videos: {
        youtubeId: string;
        title?: string | undefined;
        start?: number | undefined;
    }[];
    flashcards: {
        front: string;
        back: string;
    }[];
    quiz: {
        question: string;
        choices: string[];
        answer: number;
        explanation?: string | undefined;
    }[];
    authors: string[];
    level?: number | undefined;
    updated?: string | undefined;
}, {
    title: string;
    summary: string;
    tags: string[];
    difficulty: string;
    estimatedMinutes: number;
    status?: string | undefined;
    level?: number | undefined;
    prerequisites?: string[] | undefined;
    relatedTo?: string[] | undefined;
    videos?: {
        youtubeId: string;
        title?: string | undefined;
        start?: number | undefined;
    }[] | undefined;
    flashcards?: {
        front: string;
        back: string;
    }[] | undefined;
    quiz?: {
        question: string;
        choices: string[];
        answer: number;
        explanation?: string | undefined;
    }[] | undefined;
    updated?: string | undefined;
    authors?: string[] | undefined;
}>;
export const PathLevelSchema: z.ZodObject<{
    level: z.ZodNumber;
    title: z.ZodString;
    topics: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    title: string;
    level: number;
    topics: string[];
}, {
    title: string;
    level: number;
    topics: string[];
}>;
/** A path file's frontmatter (`paths/<id>.mdx`). The app adds `id` from the file name. */
export const PathFrontmatterSchema: z.ZodObject<{
    title: z.ZodString;
    summary: z.ZodString;
    levels: z.ZodArray<z.ZodObject<{
        level: z.ZodNumber;
        title: z.ZodString;
        topics: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        title: string;
        level: number;
        topics: string[];
    }, {
        title: string;
        level: number;
        topics: string[];
    }>, "many">;
    status: z.ZodDefault<z.ZodEnum<[string, ...string[]]>>;
}, "strict", z.ZodTypeAny, {
    title: string;
    status: string;
    summary: string;
    levels: {
        title: string;
        level: number;
        topics: string[];
    }[];
}, {
    title: string;
    summary: string;
    levels: {
        title: string;
        level: number;
        topics: string[];
    }[];
    status?: string | undefined;
}>;
/** `glossary/<pathId>.json`: term → entry. */
export const GlossaryEntrySchema: z.ZodObject<{
    definition: z.ZodString;
    href: z.ZodOptional<z.ZodString>;
    linkLabel: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    definition: string;
    href?: string | undefined;
    linkLabel?: string | undefined;
}, {
    definition: string;
    href?: string | undefined;
    linkLabel?: string | undefined;
}>;
export const GlossarySchema: z.ZodRecord<z.ZodString, z.ZodObject<{
    definition: z.ZodString;
    href: z.ZodOptional<z.ZodString>;
    linkLabel: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    definition: string;
    href?: string | undefined;
    linkLabel?: string | undefined;
}, {
    definition: string;
    href?: string | undefined;
    linkLabel?: string | undefined;
}>>;
export const ResourceSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    youtubeId: z.ZodString;
    start: z.ZodOptional<z.ZodNumber>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"video">;
}, "strict", z.ZodTypeAny, {
    youtubeId: string;
    title: string;
    type: "video";
    start?: number | undefined;
    topic?: string | undefined;
}, {
    youtubeId: string;
    title: string;
    type: "video";
    start?: number | undefined;
    topic?: string | undefined;
}>, z.ZodObject<{
    prompt: z.ZodString;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"prompt">;
}, "strict", z.ZodTypeAny, {
    title: string;
    type: "prompt";
    prompt: string;
    topic?: string | undefined;
}, {
    title: string;
    type: "prompt";
    prompt: string;
    topic?: string | undefined;
}>, z.ZodObject<{
    url: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"notebook">;
}, "strict", z.ZodTypeAny, {
    title: string;
    type: "notebook";
    url: string;
    topic?: string | undefined;
    note?: string | undefined;
}, {
    title: string;
    type: "notebook";
    url: string;
    topic?: string | undefined;
    note?: string | undefined;
}>, z.ZodObject<{
    url: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"link">;
}, "strict", z.ZodTypeAny, {
    title: string;
    type: "link";
    url: string;
    topic?: string | undefined;
    note?: string | undefined;
}, {
    title: string;
    type: "link";
    url: string;
    topic?: string | undefined;
    note?: string | undefined;
}>]>;
export const ResourcesSchema: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    youtubeId: z.ZodString;
    start: z.ZodOptional<z.ZodNumber>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"video">;
}, "strict", z.ZodTypeAny, {
    youtubeId: string;
    title: string;
    type: "video";
    start?: number | undefined;
    topic?: string | undefined;
}, {
    youtubeId: string;
    title: string;
    type: "video";
    start?: number | undefined;
    topic?: string | undefined;
}>, z.ZodObject<{
    prompt: z.ZodString;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"prompt">;
}, "strict", z.ZodTypeAny, {
    title: string;
    type: "prompt";
    prompt: string;
    topic?: string | undefined;
}, {
    title: string;
    type: "prompt";
    prompt: string;
    topic?: string | undefined;
}>, z.ZodObject<{
    url: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"notebook">;
}, "strict", z.ZodTypeAny, {
    title: string;
    type: "notebook";
    url: string;
    topic?: string | undefined;
    note?: string | undefined;
}, {
    title: string;
    type: "notebook";
    url: string;
    topic?: string | undefined;
    note?: string | undefined;
}>, z.ZodObject<{
    url: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    topic: z.ZodOptional<z.ZodString>;
    type: z.ZodLiteral<"link">;
}, "strict", z.ZodTypeAny, {
    title: string;
    type: "link";
    url: string;
    topic?: string | undefined;
    note?: string | undefined;
}, {
    title: string;
    type: "link";
    url: string;
    topic?: string | undefined;
    note?: string | undefined;
}>]>, "many">;
/** `simulations/packages/<id>/sim.config.json`. `id` must equal the directory name (content CI checks). */
export const SimCheckpointSchema: z.ZodObject<{
    id: z.ZodString;
    hint: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    id: string;
    hint?: string | undefined;
}, {
    id: string;
    hint?: string | undefined;
}>;
export const SimConfigSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    version: z.ZodString;
    props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    checkpoints: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        hint: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        id: string;
        hint?: string | undefined;
    }, {
        id: string;
        hint?: string | undefined;
    }>, "many">>;
}, "strict", z.ZodTypeAny, {
    title: string;
    id: string;
    version: string;
    props: Record<string, unknown>;
    checkpoints: {
        id: string;
        hint?: string | undefined;
    }[];
}, {
    title: string;
    id: string;
    version: string;
    props?: Record<string, unknown> | undefined;
    checkpoints?: {
        id: string;
        hint?: string | undefined;
    }[] | undefined;
}>;
import { z } from "zod";
