// Tests for scripts/schema-declarations.mjs (LMS-content#73): the committed
// declarations match the implementation, and changing an export without regenerating
// fails the check. Run by `npm run gate`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "schema-declarations.mjs");
const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: "utf8" });

test("the committed declarations are the ones the implementation generates", () => {
  const r = run("--check");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /up to date/);
  const dts = fs.readFileSync(path.join(ROOT, "schema", "content-schema.d.mts"), "utf8");
  assert.match(dts, /^\/\/ Generated from schema\/content-schema\.mjs/);
  for (const name of ["SCHEMA_VERSION", "TopicFrontmatterSchema", "PathFrontmatterSchema", "GlossarySchema", "ResourcesSchema", "SimConfigSchema", "check"]) {
    assert.match(dts, new RegExp(`export (const|function) ${name}\\b`), name);
  }
});

test("changing an export without regenerating fails the check; regenerating fixes it", () => {
  // A copy of the schema with one extra export, and the committed declarations as its "committed" file.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "schema-drift-"));
  try {
    const module = path.join(ROOT, "schema", "drift-fixture.mjs"); // beside the real one, so `import "zod"` resolves
    const out = path.join(dir, "drift-fixture.d.mts");
    fs.writeFileSync(module, `${fs.readFileSync(path.join(ROOT, "schema", "content-schema.mjs"), "utf8")}\nexport const DRIFT = z.string();\n`);
    fs.copyFileSync(path.join(ROOT, "schema", "content-schema.d.mts"), out);
    const stale = run("--check", "--module", "schema/drift-fixture.mjs", "--out", out);
    assert.equal(stale.status, 1, stale.stdout + stale.stderr);
    assert.match(stale.stderr, /out of date/);
    const regen = run("--module", "schema/drift-fixture.mjs", "--out", out);
    assert.equal(regen.status, 0, regen.stdout + regen.stderr);
    assert.match(fs.readFileSync(out, "utf8"), /export const DRIFT: z\.ZodString;/);
    const fresh = run("--check", "--module", "schema/drift-fixture.mjs", "--out", out);
    assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
    fs.rmSync(module);
    const missing = run("--check", "--module", "schema/content-schema.mjs", "--out", path.join(dir, "none.d.mts"));
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /missing/);
  } finally {
    fs.rmSync(path.join(ROOT, "schema", "drift-fixture.mjs"), { force: true });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
