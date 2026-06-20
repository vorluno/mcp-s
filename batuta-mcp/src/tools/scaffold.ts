import type { Plan, Runner, ScaffoldResult } from "../types";
import { checkBoundaryOverlaps } from "./boundaries";
import { unsafeBoundaries } from "../lib/path-safety";
import { buildPlanPrompt } from "../lib/prompts";

export function worktreePathFor(repoPath: string, branchSlug: string): string {
  const base = repoPath.replace(/\\/g, "/").replace(/\/$/, "");
  return `${base}/.worktrees/${branchSlug}`;
}

export async function isGitRepo(runner: Runner, repoPath: string): Promise<boolean> {
  const r = await runner.run(["git", "-C", repoPath, "rev-parse", "--is-inside-work-tree"]);
  return r.code === 0 && r.stdout.trim() === "true";
}

const ALREADY_EXISTS_RE = /already exists|already used/i;

async function addWorktree(
  runner: Runner,
  repoPath: string,
  wtPath: string,
  branch: string,
): Promise<{ status: ScaffoldResult["status"]; message?: string }> {
  const cmd = (p: string, b: string) => ["git", "-C", repoPath, "worktree", "add", p, "-b", b];
  const first = await runner.run(cmd(wtPath, branch));
  if (first.code === 0) return { status: "created" };
  if (!ALREADY_EXISTS_RE.test(first.stderr)) return { status: "error", message: first.stderr };
  return { status: "exists", message: "branch/path already exists" };
}

export async function scaffoldWorktrees(
  input: { repoPath: string; plans: Plan[]; dryRun?: boolean; stackHint?: string },
  deps: { runner: Runner },
): Promise<{ ok: boolean; error?: string; results: ScaffoldResult[] }> {
  const { repoPath, plans, dryRun = false, stackHint } = input;

  if (!(await isGitRepo(deps.runner, repoPath))) {
    return { ok: false, error: `not a git repository: ${repoPath}`, results: [] };
  }
  const overlaps = checkBoundaryOverlaps(plans);
  if (overlaps.length > 0) {
    return {
      ok: false,
      error: `boundary overlap, refusing to scaffold: ${JSON.stringify(overlaps)}`,
      results: [],
    };
  }
  const unsafe = unsafeBoundaries(plans);
  if (unsafe.length > 0) {
    return { ok: false, error: `unsafe boundaries: ${JSON.stringify(unsafe)}`, results: [] };
  }

  const results: ScaffoldResult[] = [];
  for (const plan of plans) {
    const worktreePath = worktreePathFor(repoPath, plan.branchSlug);
    const command = `git -C ${repoPath} worktree add ${worktreePath} -b ${plan.branchSlug}`;
    const suggestedPrompt = buildPlanPrompt(plan, stackHint);
    if (dryRun) {
      results.push({
        branchSlug: plan.branchSlug, worktreePath, command, suggestedPrompt,
        status: "created", message: "dry-run (no se ejecutó)",
      });
      continue;
    }
    const r = await addWorktree(deps.runner, repoPath, worktreePath, plan.branchSlug);
    results.push({
      branchSlug: plan.branchSlug, worktreePath, command, suggestedPrompt,
      status: r.status, message: r.message,
    });
  }
  return { ok: true, results };
}
