// Tests for scripts/schema-declarations.mjs (LMS-content#73): the committed
// declarations match the implementation, and changing an export without regenerating
// fails the check. Run by `npm run gate`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
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
  for (const name of ["SCHEMA_VERSION", "STATUSES", "MDX_COMPONENTS", "TopicFrontmatterSchema", "PathFrontmatterSchema", "GlossarySchema", "ResourcesSchema", "SimConfigSchema", "check"]) {
    assert.match(dts, new RegExp(`export (const|function) ${name}\\b`), name);
  }
  assert.match(dts, /STATUSES: readonly \["draft", "published"\]/, "enum members survive in the declarations");
});

test("changing an export without regenerating fails the check; regenerating fixes it", () => {
  // Its own copy of the schema, in its own directory under schema/ (so `import "zod"` resolves), so
  // parallel runs can't touch each other's fixture. First the unchanged copy must pass, so that the
  // only cause of the later failure is the added export.
  const dir = fs.mkdtempSync(path.join(ROOT, "schema", ".drift-"));
  try {
    const module = path.join(dir, "fixture.mjs");
    const rel = path.relative(ROOT, module).split(path.sep).join("/");
    const out = path.join(dir, "fixture.d.mts");
    const source = fs.readFileSync(path.join(ROOT, "schema", "content-schema.mjs"), "utf8");
    fs.writeFileSync(module, source);
    assert.equal(run("--module", rel, "--out", out).status, 0, "generate for the unchanged copy");
    assert.equal(run("--check", "--module", rel, "--out", out).status, 0, "the unchanged copy is up to date");

    fs.writeFileSync(module, `${source}\nexport const DRIFT = z.string();\n`);
    const stale = run("--check", "--module", rel, "--out", out);
    assert.equal(stale.status, 1, stale.stdout + stale.stderr);
    assert.match(stale.stderr, /out of date/);
    const regen = run("--module", rel, "--out", out);
    assert.equal(regen.status, 0, regen.stdout + regen.stderr);
    assert.match(fs.readFileSync(out, "utf8"), /export const DRIFT: z\.ZodString;/);
    assert.equal(run("--check", "--module", rel, "--out", out).status, 0, "regenerated: up to date again");

    const missing = run("--check", "--module", rel, "--out", path.join(dir, "none.d.mts"));
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /missing/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
