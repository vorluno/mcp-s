import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Runner } from "./types";
import { decomposeIntoPlans } from "./tools/decompose";
import { checkBoundaryOverlaps } from "./tools/boundaries";
import { scaffoldWorktrees } from "./tools/scaffold";

export interface ServerDeps {
  runner: Runner;
  detectStack?: (repoPath: string) => Promise<string | undefined>;
}

const planShape = z.object({
  title: z.string(),
  specMd: z.string(),
  fileBoundaries: z.array(z.string()),
  branchSlug: z.string(),
});

const boundaryPlanShape = z.object({
  branchSlug: z.string(),
  fileBoundaries: z.array(z.string()),
});

function ok(structured: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structured) }],
    structuredContent: structured as Record<string, unknown>,
  };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function createServer(deps: ServerDeps): McpServer {
  const server = new McpServer({ name: "batuta-mcp", version: "0.1.0" });

  server.registerTool(
    "decompose_into_plans",
    {
      title: "Decompose into plans",
      description:
        "Split a brain dump into 2-5 plans with DISJOINT file boundaries (auto-corrects overlaps once). Returns plans, overlapsResolved, attempts.",
      inputSchema: {
        brainDump: z.string().min(1),
        projectHint: z.string().optional(),
        repoPath: z.string().optional(),
      },
      outputSchema: {
        plans: z.array(planShape),
        overlapsResolved: z.boolean(),
        attempts: z.number(),
      },
    },
    async ({ brainDump, projectHint, repoPath }) => {
      const res = await decomposeIntoPlans(
        { brainDump, projectHint, repoPath },
        { runner: deps.runner, detectStack: deps.detectStack },
      );
      if (res.plans.length === 0) {
        return fail("No plans produced (claude returned no parseable JSON array or the CLI failed).");
      }
      return ok(res);
    },
  );

  server.registerTool(
    "check_boundary_overlaps",
    {
      title: "Check boundary overlaps",
      description: "Pure check: do any plans share file boundaries? Returns overlaps and ok.",
      inputSchema: { plans: z.array(boundaryPlanShape) },
      outputSchema: {
        overlaps: z.array(
          z.object({ a: z.string(), b: z.string(), overlap: z.array(z.string()) }),
        ),
        ok: z.boolean(),
      },
    },
    async ({ plans }) => {
      const overlaps = checkBoundaryOverlaps(plans);
      return ok({ overlaps, ok: overlaps.length === 0 });
    },
  );

  server.registerTool(
    "scaffold_worktrees",
    {
      title: "Scaffold git worktrees",
      description:
        "Validate (git repo, no overlaps, safe paths) then create a git worktree per plan and return a ready-to-paste prompt per plan. Set dryRun to preview without touching disk.",
      inputSchema: {
        repoPath: z.string().min(1),
        plans: z.array(planShape),
        dryRun: z.boolean().optional(),
      },
      outputSchema: {
        results: z.array(
          z.object({
            branchSlug: z.string(),
            worktreePath: z.string(),
            command: z.string(),
            suggestedPrompt: z.string(),
            status: z.enum(["created", "exists", "error"]),
            message: z.string().optional(),
          }),
        ),
      },
    },
    async ({ repoPath, plans, dryRun }) => {
      const res = await scaffoldWorktrees({ repoPath, plans, dryRun }, { runner: deps.runner });
      if (!res.ok) return fail(res.error ?? "scaffold failed");
      return ok({ results: res.results });
    },
  );

  return server;
}
