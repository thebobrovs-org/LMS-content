#!/usr/bin/env node
/**
 * The schema's declarations, generated from the implementation (ADR 0001, LMS-content#73).
 * `schema/content-schema.d.mts` is what TypeScript consumers (the app, the admin
 * editor) read; it is emitted by tsc from schema/content-schema.mjs, never written
 * by hand, and committed.
 *
 *   node scripts/schema-declarations.mjs           # regenerate the committed file
 *   node scripts/schema-declarations.mjs --check   # fail if regenerating would change it (the gate)
 *
 * Both work on any module: pass `--module <file.mjs> --out <file.d.mts>` (the tests do).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const MODULE = path.resolve(ROOT, opt("--module", "schema/content-schema.mjs"));
const OUT = path.resolve(ROOT, opt("--out", "schema/content-schema.d.mts"));
const checkOnly = args.includes("--check");

/** The declarations tsc emits for `module`, as text. */
export function emitDeclarations(module) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "schema-dts-"));
  try {
    const r = spawnSync(
      process.execPath,
      [
        path.join(ROOT, "node_modules", "typescript", "bin", "tsc"),
        "--allowJs", "--declaration", "--emitDeclarationOnly", "--skipLibCheck", "--strict",
        "--module", "nodenext", "--moduleResolution", "nodenext", "--target", "es2022",
        "--outDir", dir, module,
      ],
      { cwd: ROOT, encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error(`tsc failed:\n${r.stdout}${r.stderr}`);
    const emitted = path.join(dir, path.basename(module).replace(/\.mjs$/, ".d.mts"));
    return `// Generated from ${path.relative(ROOT, module).split(path.sep).join("/")} by scripts/schema-declarations.mjs. Do not edit.\n${fs.readFileSync(emitted, "utf8")}`;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fresh = emitDeclarations(MODULE);
  const committed = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : null;
  const relOut = path.relative(ROOT, OUT).split(path.sep).join("/");
  if (checkOnly) {
    if (committed === fresh) {
      console.log(`✓ ${relOut} is up to date`);
    } else {
      console.error(`✗ ${relOut} is ${committed === null ? "missing" : "out of date"}: run node scripts/schema-declarations.mjs and commit the result`);
      process.exit(1);
    }
  } else {
    fs.writeFileSync(OUT, fresh);
    console.log(`${committed === fresh ? "unchanged" : "wrote"} ${relOut}`);
  }
}
