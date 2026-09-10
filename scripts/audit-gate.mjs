#!/usr/bin/env node
// Dependency audit gate (hyperstack AGREEMENT §4). Fails on any high or
// critical advisory in production dependencies unless .audit-allowlist.json
// lists it with a tracking issue and an unexpired date. An expired entry fails
// the gate again, so an accepted risk can't be forgotten. Synced from
// hyperstack/templates/repo; edit it there.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const BLOCKING = new Set(["high", "critical"]);
const today = new Date().toISOString().slice(0, 10);
const allowlist = fs.existsSync(".audit-allowlist.json")
  ? JSON.parse(fs.readFileSync(".audit-allowlist.json", "utf8"))
  : [];

// `npm audit` exits non-zero whenever it finds anything, so judge the JSON, not the exit code.
const r = spawnSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
let report;
try {
  report = JSON.parse(r.stdout);
} catch {
  console.error(`audit: npm audit produced no JSON (registry unreachable?)\n${r.stderr}`);
  process.exit(1);
}
if (report.error) {
  console.error(`audit: ${report.error.summary ?? JSON.stringify(report.error)}`);
  process.exit(1);
}

// Each advisory appears in `via` of the package that contains it; packages that
// are only affected through a dependency list plain strings and are skipped.
const advisories = new Map();
for (const [pkg, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const a of v.via) {
    if (typeof a !== "object" || !BLOCKING.has(a.severity)) continue;
    const id = a.url.split("/").pop();
    advisories.set(id, { id, pkg, severity: a.severity, title: a.title });
  }
}

const failures = [];
for (const a of advisories.values()) {
  const entry = allowlist.find((e) => e.id === a.id);
  if (!entry) failures.push(`${a.severity.padEnd(8)} ${a.id} ${a.pkg}: ${a.title}`);
  else if (entry.expires < today) failures.push(`expired  ${a.id} ${a.pkg}: allow-listed until ${entry.expires} (${entry.issue})`);
  else console.log(`allowed  ${a.id} ${a.pkg} until ${entry.expires} (${entry.issue})`);
}
for (const e of allowlist) {
  if (!advisories.has(e.id)) console.log(`note     ${e.id} is no longer reported; remove it from .audit-allowlist.json`);
}

if (failures.length) {
  console.error(`\n✖ ${failures.length} blocking advisory(ies) in production dependencies:\n${failures.join("\n")}`);
  console.error("Fix with `npm audit fix`, or allow-list with an issue and an expiry (a risk:high PR).");
  process.exit(1);
}
console.log(`✔ audit: no un-allow-listed high/critical advisories (${advisories.size} allow-listed)`);
