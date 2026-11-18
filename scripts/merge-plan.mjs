/**
 * Plan merging a batch of green pull requests without re-running CI on each one
 * (AGENTS.md, "Merging a batch of PRs"). PRs that touch no file another PR in the
 * batch touches merge together, as they are. Only PRs that share a file need main
 * merged in and CI re-run, one per round; PRs that change the gate or delete or
 * rename a file merge alone, last.
 *
 *   node scripts/merge-plan.mjs 181 182 183 ...
 *
 * Reads only git: it fetches `pull/<n>/head` and `main` from origin and diffs each PR
 * against its merge base. Prints the rounds; changes nothing on GitHub.
 */
import { spawnSync } from "node:child_process";

/** Files whose change alters the gate itself: a PR touching one never merges in a batch. */
export const GATE_PATHS = [/^pipeline\//, /^schema\//, /^scripts\//, /^\.github\//, /^package(-lock)?\.json$/, /^\.nvmrc$/, /^\.audit-allowlist\.json$/];
const touchesGate = (path) => GATE_PATHS.some((re) => re.test(path));

/**
 * @typedef {{ status: string, path: string }} Change   git --name-status: A, M, D, R…, C…
 * @typedef {{ number: number, files: Change[], mainSince: string[] }} Pr
 *   mainSince: the paths main changed since the PR's merge base.
 * @param {Pr[]} prs
 * @returns {{ rounds: number[][], alone: { number: number, why: string }[], update: Record<number, string> }}
 *   rounds[0] merges as is, together. Every PR in a later round first gets main merged in and
 *   a green CI; the PRs within one round don't share files, so they update and merge in parallel.
 *   `update` says why a PR needs main merged in even in round 1.
 */
export function plan(prs) {
  const alone = [];
  const update = {};
  const batchable = [];
  for (const pr of [...prs].sort((a, b) => a.number - b.number)) {
    const gate = pr.files.find((f) => touchesGate(f.path));
    const gone = pr.files.find((f) => /^[DR]/.test(f.status));
    if (gate) { alone.push({ number: pr.number, why: `changes the gate (${gate.path})` }); continue; }
    if (gone) { alone.push({ number: pr.number, why: `deletes or renames ${gone.path}, which other files may link to` }); continue; }
    const mainGate = pr.mainSince.find(touchesGate);
    const own = new Set(pr.files.map((f) => f.path));
    const mainSame = pr.mainSince.find((p) => own.has(p));
    if (mainGate) update[pr.number] = `main changed the gate since its base (${mainGate})`;
    else if (mainSame) update[pr.number] = `main changed ${mainSame} since its base`;
    batchable.push(pr);
  }

  // Group PRs that share a file (transitively); each group merges one PR per round.
  const parent = new Map(batchable.map((pr) => [pr.number, pr.number]));
  const find = (n) => (parent.get(n) === n ? n : find(parent.get(n)));
  const owner = new Map();
  for (const pr of batchable) {
    for (const { path } of pr.files) {
      if (owner.has(path)) parent.set(find(pr.number), find(owner.get(path)));
      else owner.set(path, pr.number);
    }
  }
  const groups = new Map();
  for (const pr of batchable) {
    const root = find(pr.number);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(pr.number);
  }

  // Round 1 is "merge as is", so a PR that must take main anyway never leads its group there:
  // such PRs go last in their group, and a group made only of them starts in round 2.
  const rounds = [[]];
  for (const members of groups.values()) {
    const ordered = [...members.filter((n) => !update[n]), ...members.filter((n) => update[n])];
    const offset = update[ordered[0]] ? 1 : 0;
    ordered.forEach((n, i) => (rounds[i + offset] ??= []).push(n));
  }
  if (!rounds[0].length) rounds.shift();
  return { rounds: rounds.map((r) => r.sort((a, b) => a - b)), alone, update };
}

/** Text for people and agents. */
export function describe({ rounds, alone, update }) {
  const out = [];
  rounds.forEach((r, i) => {
    out.push(i === 0 && !r.some((n) => update[n])
      ? `Round 1 — merge together, as they are (each already green, no shared files): ${r.map((n) => `#${n}`).join(" ")}`
      : `Round ${i + 1} — merge main into each, wait for green CI, then merge them together: ${r.map((n) => `#${n}`).join(" ")}`);
    for (const n of r) if (update[n]) out.push(`  #${n}: ${update[n]}`);
  });
  if (alone.length) {
    out.push("Then one at a time — merge main in, wait for green CI, merge:");
    for (const a of alone) out.push(`  #${a.number}: ${a.why}`);
  }
  out.push("After the last merge: check that CI on main is green (it is what tells the app to redeploy staging).");
  return out.join("\n");
}

function git(...args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

/** Read one PR from git: its changes against the merge base, and what main changed since. */
export function readPr(number) {
  const ref = `refs/merge-plan/${number}`;
  git("fetch", "--quiet", "--no-tags", "origin", `+refs/pull/${number}/head:${ref}`);
  const base = git("merge-base", "refs/merge-plan/main", ref);
  const lines = (s) => s.split("\n").filter(Boolean);
  // A rename or copy line has two paths; the PR touches both.
  const files = lines(git("diff", "--name-status", "-M", base, ref)).flatMap((l) => {
    const [status, ...paths] = l.split("\t");
    return paths.map((path) => ({ status, path }));
  });
  const mainSince = lines(git("diff", "--name-only", base, "refs/merge-plan/main"));
  return { number, files, mainSince };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const numbers = process.argv.slice(2).map(Number);
  if (!numbers.length || numbers.some((n) => !Number.isInteger(n) || n <= 0)) {
    console.error("usage: node scripts/merge-plan.mjs <pr number> [<pr number> ...]");
    process.exit(2);
  }
  git("fetch", "--quiet", "--no-tags", "origin", "+refs/heads/main:refs/merge-plan/main");
  console.log(describe(plan(numbers.map(readPr))));
}
