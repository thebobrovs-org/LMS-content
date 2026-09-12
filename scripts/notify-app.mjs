/**
 * After a merge to main, tell the app (thebobrovs-org/LMS) so its Deploy workflow
 * builds main with this content and deploys it to staging (LMS#66): a
 * `repository_dispatch` of type `content-merged` carrying the content commit.
 * Production keeps serving the content pinned in LMS/content.lock.json.
 *
 * Run by .github/workflows/ci.yml on push. Environment:
 *   GH_TOKEN     the PO's fine-grained token on LMS (Contents: read and write). Unset: a
 *                notice with the manual command, exit 0, so CI stays green before the PO's setup.
 *   GITHUB_SHA   the merged content commit (full SHA).
 *   LMS_REPO     the target (default thebobrovs-org/LMS).
 * The `gh` CLI does the request; a failed dispatch fails the job.
 */
import { spawnSync } from "node:child_process";

/**
 * What to do for `env`: a notice (nothing sent), the dispatch to send, or a refusal.
 * @param {Record<string, string | undefined>} env
 * @returns {{ kind: "notice", message: string } | { kind: "dispatch", repo: string, sha: string } | { kind: "refuse", message: string }}
 */
export function plan(env) {
  const sha = env.GITHUB_SHA ?? "";
  const repo = env.LMS_REPO || "thebobrovs-org/LMS";
  if (!/^[0-9a-f]{40}$/.test(sha)) return { kind: "refuse", message: `GITHUB_SHA must be a full 40-hex commit SHA (got '${sha}')` };
  if (!/^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/.test(repo)) return { kind: "refuse", message: `LMS_REPO must be owner/name (got '${repo}')` };
  if (!env.GH_TOKEN) {
    return { kind: "notice", message: `LMS_DISPATCH_TOKEN is not set, so the app wasn't told. To see this content on staging: gh workflow run deploy.yml -R ${repo} -f content_ref=${sha}` };
  }
  return { kind: "dispatch", repo, sha };
}

/** The `gh` command line that sends `dispatch`. */
export function ghArgs({ repo, sha }) {
  return ["api", `repos/${repo}/dispatches`, "-f", "event_type=content-merged", "-f", `client_payload[content_sha]=${sha}`];
}

/**
 * Carry out the plan. `run` executes `gh` and returns its exit status; the default spawns it.
 * @returns {{ code: number, out: string }}
 */
export function notify(env, run = (args) => spawnSync("gh", args, { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).status ?? 1) {
  const p = plan(env);
  if (p.kind === "refuse") return { code: 1, out: `::error::${p.message}` };
  if (p.kind === "notice") return { code: 0, out: `::notice::${p.message}` };
  const status = run(ghArgs(p));
  if (status !== 0) return { code: 1, out: `::error::repository_dispatch to ${p.repo} failed (gh exited ${status})` };
  return { code: 0, out: `told ${p.repo}: content-merged ${p.sha}` };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { code, out } = notify(process.env);
  (code === 0 ? console.log : console.error)(out);
  process.exit(code);
}
