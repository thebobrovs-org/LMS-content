#!/usr/bin/env node
// Dependency audit gate (hyperstack AGREEMENT §4). Fails on any high or
// critical advisory in production dependencies unless .audit-allowlist.json
// lists it with a reason, a tracking issue and an expiry date no more than
// MAX_DAYS away. The allowlist itself is validated first and the gate fails
// closed on any malformed entry. An expired entry fails the gate again, so an
// accepted risk can't be forgotten.
// Synced from hyperstack/templates/repo; edit it there. Tests: audit-gate.test.mjs.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const BLOCKING = new Set(["high", "critical"]);
export const MAX_DAYS = 90;
const GHSA_RE = /^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/;
const ISSUE_RE = /^[\w.-]+\/[\w.-]+#\d+$/;

function isIsoDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // rejects 2026-02-30
}
const daysFrom = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Everything wrong with the allowlist. Any problem fails the gate. */
export function validateAllowlist(allowlist, today) {
  if (!Array.isArray(allowlist)) return ["must be a JSON array"];
  const problems = [];
  const seen = new Set();
  allowlist.forEach((e, i) => {
    const at = `entry ${i + 1}${e?.id ? ` (${e.id})` : ""}`;
    if (!e || typeof e !== "object" || Array.isArray(e)) return problems.push(`${at}: must be an object`);
    if (typeof e.id !== "string" || !GHSA_RE.test(e.id)) problems.push(`${at}: "id" must be a GHSA id`);
    else if (seen.has(e.id)) problems.push(`${at}: duplicate id`);
    seen.add(e.id);
    if (typeof e.reason !== "string" || !e.reason.trim()) problems.push(`${at}: "reason" is required`);
    if (typeof e.issue !== "string" || !ISSUE_RE.test(e.issue)) problems.push(`${at}: "issue" must be owner/repo#number`);
    if (!isIsoDate(e.expires)) problems.push(`${at}: "expires" must be a real YYYY-MM-DD date`);
    else if (daysFrom(today, e.expires) > MAX_DAYS) problems.push(`${at}: "expires" is more than ${MAX_DAYS} days away`);
  });
  return problems;
}

/**
 * High and critical advisories in an `npm audit --json` report, keyed by GHSA
 * id. An advisory is listed in `via` of the package that contains it; packages
 * that are only affected through a dependency list plain strings, which are
 * skipped so nothing is counted twice.
 */
export function blockingAdvisories(report) {
  const found = new Map();
  for (const [pkg, v] of Object.entries(report.vulnerabilities ?? {})) {
    for (const a of v.via ?? []) {
      if (typeof a !== "object" || !BLOCKING.has(a.severity)) continue;
      const id = String(a.url ?? "").split("/").pop();
      if (!found.has(id)) found.set(id, { id, pkg, severity: a.severity, title: a.title });
    }
  }
  return found;
}

/** The gate decision: { ok, errors, notes }. Pure, so it can be tested offline. */
export function evaluate(report, allowlist, today) {
  if (!report || typeof report !== "object") return { ok: false, errors: ["npm audit produced no JSON report (registry unreachable?)"], notes: [] };
  if (report.error) return { ok: false, errors: [`npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`], notes: [] };
  const problems = validateAllowlist(allowlist, today);
  if (problems.length) return { ok: false, errors: problems.map((p) => `.audit-allowlist.json ${p}`), notes: [] };

  const advisories = blockingAdvisories(report);
  const errors = [];
  const notes = [];
  for (const a of advisories.values()) {
    const entry = allowlist.find((e) => e.id === a.id);
    if (!entry) errors.push(`${a.severity} ${a.id} ${a.pkg}: ${a.title}`);
    else if (entry.expires < today) errors.push(`expired ${a.id} ${a.pkg}: allow-listed until ${entry.expires} (${entry.issue})`);
    else notes.push(`allowed ${a.id} ${a.pkg} until ${entry.expires} (${entry.issue})`);
  }
  for (const e of allowlist) {
    if (!advisories.has(e.id)) notes.push(`note ${e.id} is no longer reported; remove it from .audit-allowlist.json`);
  }
  return { ok: errors.length === 0, errors, notes };
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  let allowlist = [];
  if (fs.existsSync(".audit-allowlist.json")) {
    try {
      allowlist = JSON.parse(fs.readFileSync(".audit-allowlist.json", "utf8"));
    } catch (e) {
      console.error(`✖ .audit-allowlist.json is not valid JSON: ${e.message}`);
      process.exit(1);
    }
  }
  // `npm audit` exits non-zero whenever it finds anything, so judge the JSON, not the exit code.
  const r = spawnSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let report = null;
  try {
    report = JSON.parse(r.stdout);
  } catch {
    if (r.stderr) console.error(r.stderr.trim());
  }
  const { ok, errors, notes } = evaluate(report, allowlist, today);
  for (const n of notes) console.log(n);
  if (!ok) {
    console.error(`\n✖ audit gate failed:\n${errors.map((e) => `  ${e}`).join("\n")}`);
    console.error("Fix with `npm audit fix`, or allow-list with a reason, an issue and an expiry (a risk:high PR).");
    process.exit(1);
  }
  console.log(`✔ audit: no un-allow-listed high/critical advisories (${allowlist.length} allow-listed)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
