// Offline tests for the audit gate's decision logic (run by `npm run gate` via
// `node --test`). Synced from hyperstack/templates/repo; edit it there.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_DAYS, evaluate, reportProblem, validateAllowlist } from "./audit-gate.mjs";

const TODAY = "2026-09-10";
const A = "GHSA-aaaa-bbbb-cccc";
const B = "GHSA-dddd-eeee-ffff";

const advisory = (id, severity, pkg = "pkg") => ({ url: `https://github.com/advisories/${id}`, severity, title: `${pkg} problem` });
// Every package in an npm audit report carries its own severity; the fixtures add one where a test doesn't care.
const report = (vulns) => ({ vulnerabilities: Object.fromEntries(Object.entries(vulns).map(([k, v]) => [k, v && typeof v === "object" && !Array.isArray(v) && !("severity" in v) && Array.isArray(v.via) ? { severity: "low", ...v } : v])) });
const entry = (id, over = {}) => ({
  id,
  package: "pkg",
  reason: "Fixed only in a major upgrade",
  issue: "thebobrovs/LMS#56",
  expires: "2026-10-02",
  ...over,
});

test("a clean report passes", () => {
  assert.equal(evaluate(report({}), [], TODAY).ok, true);
});

test("an unlisted high advisory fails", () => {
  const out = evaluate(report({ pkg: { via: [advisory(A, "high")] } }), [], TODAY);
  assert.equal(out.ok, false);
  assert.match(out.errors[0], new RegExp(A));
});

test("an unlisted critical advisory fails", () => {
  assert.equal(evaluate(report({ pkg: { via: [advisory(A, "critical")] } }), [], TODAY).ok, false);
});

test("moderate and low advisories don't block", () => {
  const out = evaluate(report({ pkg: { via: [advisory(A, "moderate"), advisory(B, "low")] } }), [], TODAY);
  assert.equal(out.ok, true);
});

test("packages affected only through a dependency are not counted twice", () => {
  const r = report({ next: { via: ["postcss"] }, postcss: { via: [advisory(A, "high", "postcss")] } });
  const out = evaluate(r, [], TODAY);
  assert.equal(out.errors.length, 1);
});

test("a valid allow-list entry passes and is reported", () => {
  const out = evaluate(report({ pkg: { via: [advisory(A, "high")] } }), [entry(A)], TODAY);
  assert.equal(out.ok, true);
  assert.match(out.notes.join("\n"), /allowed GHSA-aaaa-bbbb-cccc/);
});

test("an entry is still valid on its expiry day and fails the day after", () => {
  const r = report({ pkg: { via: [advisory(A, "high")] } });
  assert.equal(evaluate(r, [entry(A, { expires: TODAY })], TODAY).ok, true);
  const out = evaluate(r, [entry(A, { expires: "2026-09-09" })], TODAY);
  assert.equal(out.ok, false);
  assert.match(out.errors[0], /expired on 2026-09-09 \(thebobrovs\/LMS#56\)/);
});

test("an expired entry fails even when its advisory is no longer reported", () => {
  const out = evaluate(report({}), [entry(A, { expires: "2026-09-09" })], TODAY);
  assert.equal(out.ok, false, "a clean report doesn't excuse a forgotten entry");
  assert.match(out.errors[0], /expired on 2026-09-09/);
  assert.deepEqual(validateAllowlist([entry(A, { expires: "2026-09-09" })], TODAY).length, 1);
});

test("an allow-list entry for a different advisory doesn't help", () => {
  assert.equal(evaluate(report({ pkg: { via: [advisory(A, "high")] } }), [entry(B)], TODAY).ok, false);
});

test("the allowlist fails closed on missing or malformed fields", () => {
  const r = report({ pkg: { via: [advisory(A, "high")] } });
  const bad = [
    { id: A },
    entry(A, { issue: undefined }),
    entry(A, { issue: "LMS 56" }),
    entry(A, { expires: undefined }),
    entry(A, { expires: "never" }),
    entry(A, { expires: "2026-13-01" }),
    entry(A, { expires: "2026-02-30" }),
    entry(A, { expires: "10/02/2026" }),
    entry(A, { reason: " " }),
    entry("CVE-2026-1234"),
  ];
  for (const e of bad) {
    const out = evaluate(r, [e], TODAY);
    assert.equal(out.ok, false, `should fail: ${JSON.stringify(e)}`);
    assert.match(out.errors[0], /^\.audit-allowlist\.json entry 1/);
  }
});

test(`an expiry more than ${MAX_DAYS} days away is rejected`, () => {
  assert.deepEqual(validateAllowlist([entry(A, { expires: "2026-12-08" })], TODAY), []); // 89 days
  assert.equal(validateAllowlist([entry(A, { expires: "2027-01-01" })], TODAY).length, 1);
});

test("duplicate ids and non-array allowlists are rejected", () => {
  assert.equal(validateAllowlist([entry(A), entry(A)], TODAY).length, 1);
  assert.deepEqual(validateAllowlist({ id: A }, TODAY), ["must be a JSON array"]);
});

test("a malformed allowlist fails even when nothing is reported", () => {
  assert.equal(evaluate(report({}), [{ id: A }], TODAY).ok, false);
});

test("an npm audit error or missing report fails", () => {
  assert.equal(evaluate({ error: { summary: "getaddrinfo ENOTFOUND registry.npmjs.org" } }, [], TODAY).ok, false);
  assert.equal(evaluate(null, [], TODAY).ok, false);
});

test("a report that isn't the documented shape fails closed, never passes as clean", () => {
  const bad = [
    {},
    [],
    "clean",
    { vulnerabilities: null },
    { vulnerabilities: [] },
    { vulnerabilities: { pkg: {} } },
    { vulnerabilities: { pkg: { via: "postcss" } } },
    { vulnerabilities: { pkg: { via: [null] } } },
    { vulnerabilities: { pkg: { via: [42] } } },
    { vulnerabilities: { pkg: null } },
    // An advisory object the gate can't judge is not a clean advisory.
    { vulnerabilities: { pkg: { via: [{}] } } },
    { vulnerabilities: { pkg: { via: [[]] } } },
    { vulnerabilities: { pkg: { severity: "critical", via: [{}] } } },
    { vulnerabilities: { pkg: { via: [{ url: `https://github.com/advisories/${A}` }] } } },
    { vulnerabilities: { pkg: { via: [{ severity: "extreme", url: `https://github.com/advisories/${A}` }] } } },
    { vulnerabilities: { pkg: { via: [{ severity: "critical" }] } } },
    { vulnerabilities: { pkg: { via: [{ severity: "critical", url: "https://example.com/not-a-ghsa" }] } } },
    { vulnerabilities: { pkg: { via: [{ severity: "low", url: A }] } } },
    { vulnerabilities: { pkg: { via: [{ severity: "low", url: `not-a-url/${A}` }] } } },
    // A package the report calls critical must be explained by an advisory somewhere behind its references.
    { vulnerabilities: { pkg: { severity: "critical", via: [] } } },
    { vulnerabilities: { pkg: { severity: "critical", via: ["missing"] } } },
    { vulnerabilities: { pkg: { severity: "high", via: ["other"] }, other: { severity: "high", via: ["pkg"] } } },
    { vulnerabilities: { pkg: { severity: "critical", via: ["pkg"] } } },
    // ...whatever severity it claims, or none.
    { vulnerabilities: { pkg: { via: ["pkg"] } } },
    { vulnerabilities: { pkg: { severity: "moderate", via: ["pkg"] } } },
    { vulnerabilities: { pkg: { severity: "low", via: ["other"] }, other: { severity: "low", via: ["pkg"] } } },
    { vulnerabilities: { pkg: { severity: "low", via: [advisory(A, "low")] }, other: { via: ["pkg"] } } },
    { vulnerabilities: { pkg: { severity: "severe", via: [advisory(A, "low")] } } },
  ];
  for (const r of bad) {
    const out = evaluate(r, [], TODAY);
    assert.equal(out.ok, false, `should fail: ${JSON.stringify(r)}`);
    assert.match(out.errors[0], /npm audit/, JSON.stringify(r));
  }
  assert.equal(reportProblem(report({})), null);
  assert.equal(reportProblem(report({ postcss: { via: [advisory(A, "low")] }, pkg: { via: ["postcss", advisory(B, "low")] } })), null);
  // A critical package explained through a chain of references is fine, and its advisory is counted once.
  const chain = report({ app: { severity: "critical", via: ["lib"] }, lib: { severity: "critical", via: ["core"] }, core: { severity: "critical", via: [advisory(A, "critical", "core")] } });
  assert.equal(reportProblem(chain), null);
  assert.equal(evaluate(chain, [], TODAY).errors.length, 1);
  // A cycle that does reach an advisory is a legitimate dependency loop.
  const loop = report({ a: { severity: "high", via: ["b"] }, b: { severity: "high", via: ["a", advisory(A, "high", "b")] } });
  assert.equal(reportProblem(loop), null);
  assert.equal(evaluate(loop, [], TODAY).errors.length, 1);
});

test("stale allow-list entries are notes, not failures", () => {
  const out = evaluate(report({}), [entry(A)], TODAY);
  assert.equal(out.ok, true);
  assert.match(out.notes[0], /no longer reported/);
});
