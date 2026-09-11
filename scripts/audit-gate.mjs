#!/usr/bin/env node
// Dependency audit gate (hyperstack AGREEMENT §4). Fails on any high or
// critical advisory in production dependencies unless .audit-allowlist.json
// lists it with a reason, a tracking issue and an expiry date no more than
// MAX_DAYS away. The allowlist itself is validated first and the gate fails
// closed on any malformed or expired entry, whatever the audit reports, so an
// accepted risk can't be forgotten. A report that isn't the shape `npm audit
// --json` documents fails closed too: an incompatible npm is not a clean audit.
// Synced from hyperstack/templates/repo; edit it there. Tests: audit-gate.test.mjs.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const BLOCKING = new Set(["high", "critical"]);
export const SEVERITIES = new Set(["info", "low", "moderate", "high", "critical"]);
export const MAX_DAYS = 90;
const GHSA_RE = /^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/;
const ADVISORY_URL_RE = /^https:\/\/github\.com\/advisories\/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/;
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
    else if (e.expires < today) problems.push(`${at}: expired on ${e.expires} (${e.issue ?? "no issue"}); fix the advisory, or extend the entry in a risk:high PR`);
  });
  return problems;
}

/** Why `report` isn't an `npm audit --json` report this gate understands, or null. Anything else fails closed. */
export function reportProblem(report) {
  const plain = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  if (!plain(report)) return "npm audit produced no JSON report (registry unreachable?)";
  if (report.error) return `npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`;
  if (!plain(report.vulnerabilities)) return "npm audit report has no \"vulnerabilities\" object (an npm this gate doesn't understand?)";
  const vulns = report.vulnerabilities;
  for (const [pkg, v] of Object.entries(vulns)) {
    if (!plain(v) || !Array.isArray(v.via) || v.via.length === 0) return `npm audit report: "${pkg}" has no "via" list`;
    if (!SEVERITIES.has(v.severity)) return `npm audit report: "${pkg}" has severity ${JSON.stringify(v.severity ?? null)}, not one this gate knows`;
    for (const a of v.via) {
      if (typeof a === "string") {
        // A package affected through a dependency names it; the name must be in the report.
        if (!plain(vulns[a])) return `npm audit report: "${pkg}" is affected via "${a}", which the report doesn't describe`;
        continue;
      }
      if (!plain(a)) return `npm audit report: "${pkg}" has a malformed "via" entry`;
      if (!SEVERITIES.has(a.severity)) return `npm audit report: "${pkg}" has an advisory with severity ${JSON.stringify(a.severity ?? null)}, not one this gate knows`;
      if (typeof a.url !== "string" || !ADVISORY_URL_RE.test(a.url)) return `npm audit report: "${pkg}" has an advisory without a GHSA advisory url`;
    }
  }
  // Every package must reach an advisory object through its dependency references; a chain that
  // only points at other packages (or at itself) explains nothing, whatever severity it claims.
  for (const [pkg, v] of Object.entries(vulns)) {
    const seen = new Set();
    const stack = [pkg];
    let found = false;
    while (stack.length && !found) {
      const name = stack.pop();
      if (seen.has(name)) continue;
      seen.add(name);
      for (const a of vulns[name].via) {
        if (typeof a === "object") found = true;
        else stack.push(a);
      }
    }
    if (!found) return `npm audit report: "${pkg}" is ${v.severity} but no advisory explains it`;
  }
  return null;
}

/**
 * High and critical advisories in a checked (reportProblem) `npm audit --json`
 * report, keyed by GHSA id. An advisory is listed in `via` of the package that
 * contains it; packages that are only affected through a dependency list plain
 * strings, which are skipped so nothing is counted twice.
 */
export function blockingAdvisories(report) {
  const found = new Map();
  for (const [pkg, v] of Object.entries(report.vulnerabilities)) {
    for (const a of v.via) {
      if (typeof a !== "object" || !BLOCKING.has(a.severity)) continue;
      const id = String(a.url ?? "").split("/").pop();
      if (!found.has(id)) found.set(id, { id, pkg, severity: a.severity, title: a.title });
    }
  }
  return found;
}

/** The gate decision: { ok, errors, notes }. Pure, so it can be tested offline. */
export function evaluate(report, allowlist, today) {
  const bad = reportProblem(report);
  if (bad) return { ok: false, errors: [bad], notes: [] };
  const problems = validateAllowlist(allowlist, today);
  if (problems.length) return { ok: false, errors: problems.map((p) => `.audit-allowlist.json ${p}`), notes: [] };

  const advisories = blockingAdvisories(report);
  const errors = [];
  const notes = [];
  for (const a of advisories.values()) {
    const entry = allowlist.find((e) => e.id === a.id);
    if (!entry) errors.push(`${a.severity} ${a.id} ${a.pkg}: ${a.title}`);
    else notes.push(`allowed ${a.id} ${a.pkg} until ${entry.expires} (${entry.issue})`); // an expired entry never gets here: validateAllowlist rejects it
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
