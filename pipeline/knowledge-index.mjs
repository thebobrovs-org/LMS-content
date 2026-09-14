#!/usr/bin/env node
// Build knowledge/index.json from the approved records (LMS-content#105): what the app and the
// agents read. `--check` fails when the committed file is not what the records produce, so the
// gate keeps it generated, never hand-edited. Usage: node pipeline/knowledge-index.mjs [--check] [--root <dir>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, indexText, loadRecords, recordProblems } from "./knowledge.mjs";

const rootArg = process.argv.indexOf("--root");
const ROOT = rootArg > 0 ? path.resolve(process.argv[rootArg + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "knowledge");
const OUT = path.join(DIR, "index.json");
const checkOnly = process.argv.includes("--check");

const { records, problems } = loadRecords(DIR, ROOT);
const { errors } = recordProblems(records);
const all = [...problems, ...errors];
if (all.length) {
  console.error(`✗ knowledge records: ${all.length} problem(s) (the validator has the full list):`);
  for (const e of all) console.error(`  - ${e}`);
  process.exit(1);
}
const text = indexText(buildIndex(records));
if (checkOnly) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== text) {
    console.error("✗ knowledge/index.json is out of date: run `node pipeline/knowledge-index.mjs` and commit the result");
    process.exit(1);
  }
  console.log(`✓ knowledge/index.json is current (${records.filter((r) => r.data.status === "approved").length} approved record(s) of ${records.length})`);
} else {
  fs.writeFileSync(OUT, text);
  console.log(`✓ wrote knowledge/index.json (${records.filter((r) => r.data.status === "approved").length} approved record(s) of ${records.length})`);
}
