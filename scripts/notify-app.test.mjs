// LMS#66: after a merge, CI tells the app about the new content; without the PO's token it only says so.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ghArgs, notify, plan } from "./notify-app.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "notify-app.mjs");
const SHA = "f".repeat(40);

test("without a token: a notice naming the manual command, exit 0, nothing sent", () => {
  const p = plan({ GITHUB_SHA: SHA });
  assert.equal(p.kind, "notice");
  assert.match(p.message, new RegExp(`gh workflow run deploy.yml -R thebobrovs-org/LMS -f content_ref=${SHA}`));
  let called = 0;
  const r = notify({ GITHUB_SHA: SHA }, () => (called++, 0));
  assert.deepEqual(r, { code: 0, out: `::notice::${p.message}` });
  assert.equal(called, 0);
});

test("with a token: one repository_dispatch to the app with the event type and the commit", () => {
  const p = plan({ GITHUB_SHA: SHA, GH_TOKEN: "t" });
  assert.deepEqual(p, { kind: "dispatch", repo: "thebobrovs-org/LMS", sha: SHA });
  assert.deepEqual(ghArgs(p), ["api", "repos/thebobrovs-org/LMS/dispatches", "-f", "event_type=content-merged", "-f", `client_payload[content_sha]=${SHA}`]);
  const calls = [];
  const r = notify({ GITHUB_SHA: SHA, GH_TOKEN: "t" }, (args) => (calls.push(args), 0));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ghArgs(p));
  assert.deepEqual(r, { code: 0, out: `told thebobrovs-org/LMS: content-merged ${SHA}` });
  assert.equal(plan({ GITHUB_SHA: SHA, GH_TOKEN: "t", LMS_REPO: "o/r" }).repo, "o/r");
});

test("a failed dispatch fails the job", () => {
  const r = notify({ GITHUB_SHA: SHA, GH_TOKEN: "t" }, () => 22);
  assert.equal(r.code, 1);
  assert.match(r.out, /::error::repository_dispatch to thebobrovs-org\/LMS failed \(gh exited 22\)/);
});

test("a missing or malformed commit, or a bad target, is refused before anything is sent", () => {
  for (const env of [{}, { GITHUB_SHA: "abc" }, { GITHUB_SHA: "main", GH_TOKEN: "t" }]) {
    const r = notify(env, () => 0);
    assert.equal(r.code, 1);
    assert.match(r.out, /GITHUB_SHA must be a full 40-hex commit SHA/);
  }
  assert.match(notify({ GITHUB_SHA: SHA, GH_TOKEN: "t", LMS_REPO: "../x" }, () => 0).out, /LMS_REPO must be owner\/name/);
});

test("the command line runs gh from PATH with exactly those arguments, and passes its failure through", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "notify-app-"));
  try {
    const log = path.join(dir, "gh.log");
    fs.writeFileSync(path.join(dir, "gh"), `#!/bin/sh\nprintf '%s\\n' "$@" > "${log}"\nexit "\${GH_EXIT:-0}"\n`, { mode: 0o755 });
    const run = (extra) => spawnSync(process.execPath, [SCRIPT], { encoding: "utf8", env: { PATH: `${dir}:${process.env.PATH}`, GITHUB_SHA: SHA, ...extra } });
    const ok = run({ GH_TOKEN: "t" });
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), ghArgs({ repo: "thebobrovs-org/LMS", sha: SHA }));
    assert.match(ok.stdout, /told thebobrovs-org\/LMS/);
    const failed = run({ GH_TOKEN: "t", GH_EXIT: "3" });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /gh exited 3/);
    const quiet = run({});
    assert.equal(quiet.status, 0);
    assert.match(quiet.stdout, /::notice::LMS_DISPATCH_TOKEN is not set/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
