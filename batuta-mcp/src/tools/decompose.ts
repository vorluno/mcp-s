import type { Plan, Runner, DecomposeResult } from "../types";
import { checkBoundaryOverlaps } from "./boundaries";
import { buildDecomposePrompt, buildFixOverlapsPrompt } from "../lib/prompts";

function toKebabCase(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function validateEntry(entry: unknown): Plan | null {
  if (typeof entry !== "object" || entry === null) return null;
  const obj = entry as Record<string, unknown>;
  const title = obj["title"];
  if (typeof title !== "string" || title.trim() === "") return null;
  const specMd = typeof obj["specMd"] === "string" ? obj["specMd"] : "";
  let fileBoundaries: string[] = [];
  if (Array.isArray(obj["fileBoundaries"])) {
    fileBoundaries = obj["fileBoundaries"].filter((i): i is string => typeof i === "string");
  }
  const rawSlug = obj["branchSlug"];
  const branchSlug =
    typeof rawSlug === "string" && rawSlug.trim() !== "" ? rawSlug : toKebabCase(title);
  return { title, specMd, fileBoundaries, branchSlug };
}

function extractFirstJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "[") depth++;
    else if (ch === "]") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

/** PURE, defensivo: nunca tira; ante cualquier fallo devuelve []. */
export function parseDecomposition(raw: string): Plan[] {
  try {
    if (raw.trim() === "") return [];
    let innerText = raw;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const resultMsg = parsed.find(
          (m): m is Record<string, unknown> =>
            typeof m === "object" && m !== null &&
            (m as Record<string, unknown>)["type"] === "result" &&
            typeof (m as Record<string, unknown>)["result"] === "string",
        );
        if (resultMsg) innerText = resultMsg["result"] as string;
      } else if (
        typeof parsed === "object" && parsed !== null && "result" in parsed &&
        typeof (parsed as Record<string, unknown>)["result"] === "string"
      ) {
        innerText = (parsed as Record<string, unknown>)["result"] as string;
      }
    } catch { /* raw no es JSON externo; seguimos con raw */ }

    const arrayStr = extractFirstJsonArray(innerText);
    if (arrayStr === null) return [];
    const arr = JSON.parse(arrayStr) as unknown;
    if (!Array.isArray(arr)) return [];
    const plans: Plan[] = [];
    for (const entry of arr) {
      const plan = validateEntry(entry);
      if (plan !== null) plans.push(plan);
    }
    return plans;
  } catch {
    return [];
  }
}

export interface DecomposeDeps {
  runner: Runner;
  detectStack?: (repoPath: string) => Promise<string | undefined>;
  timeoutMs?: number;
}

async function runClaude(runner: Runner, prompt: string, timeoutMs: number): Promise<string> {
  const r = await runner.run(["claude", "-p", prompt, "--output-format", "json"], { timeoutMs });
  return r.stdout;
}

export async function decomposeIntoPlans(
  input: { brainDump: string; projectHint?: string; repoPath?: string },
  deps: DecomposeDeps,
): Promise<DecomposeResult> {
  const timeoutMs = deps.timeoutMs ?? 120_000;
  let stackHint = input.projectHint;
  if (!stackHint && input.repoPath && deps.detectStack) {
    stackHint = await deps.detectStack(input.repoPath);
  }

  let plans = parseDecomposition(
    await runClaude(deps.runner, buildDecomposePrompt(input.brainDump, stackHint), timeoutMs),
  );
  let attempts = 1;
  let overlaps = checkBoundaryOverlaps(plans);

  if (overlaps.length > 0 && plans.length > 0) {
    const fixed = parseDecomposition(
      await runClaude(
        deps.runner,
        buildFixOverlapsPrompt(input.brainDump, plans, overlaps, stackHint),
        timeoutMs,
      ),
    );
    attempts = 2;
    if (fixed.length > 0) {
      plans = fixed;
      overlaps = checkBoundaryOverlaps(plans);
    }
  }

  return { plans, overlapsResolved: overlaps.length === 0, attempts };
}
