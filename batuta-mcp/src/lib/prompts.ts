import type { Plan, Overlap } from "../types";

function stackLine(stackHint?: string): string {
  return stackHint ? `\nTarget project stack: ${stackHint}.` : "";
}

export function buildDecomposePrompt(brainDump: string, stackHint?: string): string {
  return `You are a software architect decomposing a project brain dump into discrete, actionable plans.${stackLine(stackHint)}

Your task:
1. Read the brain dump below
2. Identify 2-5 independent features, modules, or refactors
3. Ensure each plan has DISJOINT file boundaries (no overlapping files across plans)
4. Return ONLY a JSON array — no prose, no markdown fences, just the array

Each plan object must have exactly these fields:
- "title": (string) short feature name in title case
- "specMd": (string) markdown spec with ## headers, acceptance criteria, implementation notes
- "fileBoundaries": (array of strings) exact RELATIVE file or directory paths this plan will touch (no absolute paths, no "..")
- "branchSlug": (string) kebab-case branch name (e.g., "feat/auth-module")

CRITICAL: The output must be valid JSON and nothing else.

Brain dump:
---
${brainDump}
---

Return the JSON array now:`;
}

export function buildFixOverlapsPrompt(
  brainDump: string,
  plans: Plan[],
  overlaps: Overlap[],
  stackHint?: string,
): string {
  const overlapText = overlaps
    .map((o) => `- "${o.a}" and "${o.b}" both touch: ${o.overlap.join(", ")}`)
    .join("\n");
  return `Your previous decomposition has OVERLAPPING file boundaries. Plans must be disjoint.${stackLine(stackHint)}

Overlaps to fix:
${overlapText}

Previous plans:
${JSON.stringify(plans, null, 2)}

Re-assign file boundaries so NO file appears in more than one plan (move shared files into a single owning plan, or split the work differently). Return ONLY the corrected JSON array, same shape as before.

Original brain dump:
---
${brainDump}
---

Return the corrected JSON array now:`;
}

export function buildPlanPrompt(plan: Plan, stackHint?: string): string {
  const boundaries = plan.fileBoundaries.length
    ? plan.fileBoundaries.map((f) => `  - ${f}`).join("\n")
    : "  (no file boundaries specified)";
  return `You are working on a discrete feature branch.${stackLine(stackHint)}

## Plan Title
${plan.title}

## Objective & Specification
${plan.specMd || "(no specification provided)"}

## File Boundaries
You MUST work ONLY within these files and directories:
${boundaries}

Any work outside these boundaries will conflict with other agents. Do not touch files outside this list.

## When You're Done
1. Run the project's test suite and type-check; make sure they pass.
2. Create a NEW commit (do not amend) with your changes:
   git add <specific-files>
   git commit -m "feat: <your-feature>"
3. Report the commit SHA and a short summary.

Begin your work now.`;
}
