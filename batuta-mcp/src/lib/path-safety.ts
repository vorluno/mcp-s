import type { BoundaryPlan } from "../types";

/** true si la frontera es relativa y no escapa del repo. */
export function isBoundarySafe(boundary: string): boolean {
  const b = boundary.trim().replace(/\\/g, "/");
  if (b === "") return false;
  if (b.startsWith("/")) return false; // absoluta POSIX
  if (/^[a-zA-Z]:/.test(b)) return false; // absoluta Windows (C:\...)
  const segments = b.split("/");
  if (segments.includes("..")) return false;
  return true;
}

export function unsafeBoundaries(
  plans: BoundaryPlan[],
): { branchSlug: string; boundary: string }[] {
  const out: { branchSlug: string; boundary: string }[] = [];
  for (const p of plans) {
    for (const boundary of p.fileBoundaries) {
      if (!isBoundarySafe(boundary)) out.push({ branchSlug: p.branchSlug, boundary });
    }
  }
  return out;
}
