// Offline tests for the audit gate's decision logic (run by `npm run gate` via
// `node --test`). Synced from hyperstack/templates/repo; edit it there.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_DAYS, evaluate, validateAllowlist } from "./audit-gate.mjs";

const TODAY = "2026-09-10";
const A = "GHSA-aaaa-bbbb-cccc";
const B = "GHSA-dddd-eeee-ffff";

const advisory = (id, severity, pkg = "pkg") => ({ url: `https://github.com/advisories/${id}`, severity, title: `${pkg} problem` });
const report = (vulns) => ({ vulnerabilities: vulns });
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
  assert.match(out.errors[0], /^expired/);
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

test("stale allow-list entries are notes, not failures", () => {
  const out = evaluate(report({}), [entry(A)], TODAY);
  assert.equal(out.ok, true);
  assert.match(out.notes[0], /no longer reported/);
});
