// The schema's TypeScript contract (LMS-content#73): the generated declarations keep
// the enum members, defaulted fields are required in a parsed value, and `check()`
// returns the schema's output type. A fixture is type-checked with tsc under
// --strict; lines marked @ts-expect-error must fail to compile, so a widened type
// makes this test fail. Run by `npm run gate`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TSC = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");

const FIXTURE = `
import { TopicFrontmatterSchema, PathFrontmatterSchema, SimConfigSchema, STATUSES, DIFFICULTIES, check } from "./content-schema.mjs";

const topic = check(TopicFrontmatterSchema, {}, "t.mdx");
if (topic.ok) {
  // Defaulted fields are required in the parsed value.
  const status: "draft" | "published" = topic.value.status;
  const quiz: { question: string; choices: string[]; answer: number; explanation?: string }[] = topic.value.quiz;
  const authors: string[] = topic.value.authors;
  // The enum members survive: a value outside them is a type error.
  // @ts-expect-error "review" is not a status
  const bad: typeof topic.value.status = "review";
  // @ts-expect-error "hard" is not a difficulty
  const hard: typeof topic.value.difficulty = "hard";
  void [status, quiz, authors, bad, hard];
}
const path = check(PathFrontmatterSchema, {});
if (path.ok) {
  const levels: { level: number; title: string; topics: string[] }[] = path.value.levels;
  const status: "draft" | "published" = path.value.status;
  void [levels, status];
}
const sim = check(SimConfigSchema, {});
if (sim.ok) {
  const checkpoints: { id: string; hint?: string }[] = sim.value.checkpoints;
  const props: Record<string, unknown> = sim.value.props;
  void [checkpoints, props];
}
// The tuples are literal.
const s: readonly ["draft", "published"] = STATUSES;
const d: readonly ["beginner", "intermediate", "advanced"] = DIFFICULTIES;
// @ts-expect-error a status literal outside the tuple
const notStatus: (typeof STATUSES)[number] = "review";
void [s, d, notStatus];
`;

test("the generated declarations keep enum members, defaults and check()'s output type", () => {
  const dir = fs.mkdtempSync(path.join(ROOT, "schema", ".types-"));
  try {
    // The fixture sits beside the schema so its relative import resolves to content-schema.d.mts.
    const fixture = path.join(dir, "fixture.ts");
    fs.writeFileSync(fixture, FIXTURE.replace('"./content-schema.mjs"', '"../content-schema.mjs"'));
    const r = spawnSync(process.execPath, [TSC, "--noEmit", "--strict", "--module", "nodenext", "--moduleResolution", "nodenext", "--target", "es2022", "--skipLibCheck", fixture], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `tsc:\n${r.stdout}${r.stderr}`);
    // The fixture is only meaningful if a widened type would fail: remove one expectation and it must not compile.
    fs.writeFileSync(fixture, FIXTURE.replace('"./content-schema.mjs"', '"../content-schema.mjs"').replace('  // @ts-expect-error "review" is not a status\n', ""));
    const widened = spawnSync(process.execPath, [TSC, "--noEmit", "--strict", "--module", "nodenext", "--moduleResolution", "nodenext", "--target", "es2022", "--skipLibCheck", fixture], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.notEqual(widened.status, 0, "without the expect-error, assigning \"review\" must be a type error");
    assert.match(widened.stdout, /not assignable to type '"draft" \| "published"'/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
