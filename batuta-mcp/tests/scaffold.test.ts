import { test, expect } from "bun:test";
import { worktreePathFor, scaffoldWorktrees } from "../src/tools/scaffold";
import { FakeRunner } from "../src/lib/runner";
import type { Plan, RunResult } from "../src/types";

const okRepo: RunResult = { code: 0, stdout: "true\n", stderr: "" };
const plan = (slug: string, files: string[]): Plan => ({
  title: slug, specMd: "", fileBoundaries: files, branchSlug: slug,
});

test("worktreePathFor usa .worktrees y normaliza separadores", () => {
  expect(worktreePathFor("C:\\proj", "feat-a")).toBe("C:/proj/.worktrees/feat-a");
});

test("rechaza si no es repo git", async () => {
  const runner = new FakeRunner([{ code: 128, stdout: "", stderr: "not a git repo" }]);
  const res = await scaffoldWorktrees(
    { repoPath: "/x", plans: [plan("a", ["a.ts"])] },
    { runner },
  );
  expect(res.ok).toBe(false);
  expect(res.error).toContain("git");
});

test("rechaza si hay solape", async () => {
  const runner = new FakeRunner([okRepo]);
  const res = await scaffoldWorktrees(
    { repoPath: "/x", plans: [plan("a", ["x.ts"]), plan("b", ["x.ts"])] },
    { runner },
  );
  expect(res.ok).toBe(false);
  expect(res.error?.toLowerCase()).toContain("overlap");
});

test("rechaza fronteras inseguras", async () => {
  const runner = new FakeRunner([okRepo]);
  const res = await scaffoldWorktrees(
    { repoPath: "/x", plans: [plan("a", ["../escape.ts"])] },
    { runner },
  );
  expect(res.ok).toBe(false);
  expect(res.error?.toLowerCase()).toContain("unsafe");
});

test("dryRun no ejecuta git worktree add", async () => {
  const runner = new FakeRunner([okRepo]); // solo el rev-parse
  const res = await scaffoldWorktrees(
    { repoPath: "/x", plans: [plan("a", ["a.ts"])], dryRun: true },
    { runner },
  );
  expect(res.ok).toBe(true);
  expect(res.results[0]!.suggestedPrompt).toContain("a");
  expect(res.results[0]!.message).toContain("dry-run");
  // solo se llamó al rev-parse, no a worktree add
  expect(runner.calls.length).toBe(1);
});

test("crea worktree real (status created)", async () => {
  const runner = new FakeRunner([okRepo, { code: 0, stdout: "", stderr: "" }]);
  const res = await scaffoldWorktrees(
    { repoPath: "/x", plans: [plan("a", ["a.ts"])] },
    { runner },
  );
  expect(res.ok).toBe(true);
  expect(res.results[0]!.status).toBe("created");
  expect(runner.calls[1]!.cmd).toContain("worktree");
});
