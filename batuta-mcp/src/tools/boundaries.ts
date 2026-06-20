import type { BoundaryPlan, Overlap } from "../types";

function normalize(path: string): string {
  return path.trim().toLowerCase().replace(/\\/g, "/");
}

export function checkBoundaryOverlaps(plans: BoundaryPlan[]): Overlap[] {
  const normalized = plans
    .filter((p) => p.fileBoundaries.length > 0)
    .map((p) => ({
      id: p.branchSlug,
      set: new Set(p.fileBoundaries.map(normalize)),
    }));

  const results: Overlap[] = [];
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i]!;
      const b = normalized[j]!;
      const overlap: string[] = [];
      for (const norm of a.set) if (b.set.has(norm)) overlap.push(norm);
      if (overlap.length > 0) results.push({ a: a.id, b: b.id, overlap });
    }
  }
  return results;
}
