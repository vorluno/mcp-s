import { test, expect } from "bun:test";
import { checkBoundaryOverlaps } from "../src/tools/boundaries";

test("sin solape → []", () => {
  expect(
    checkBoundaryOverlaps([
      { branchSlug: "a", fileBoundaries: ["src/a.ts"] },
      { branchSlug: "b", fileBoundaries: ["src/b.ts"] },
    ]),
  ).toEqual([]);
});

test("detecta solape normalizando mayúsculas y separadores", () => {
  const out = checkBoundaryOverlaps([
    { branchSlug: "a", fileBoundaries: ["src/Shared.ts"] },
    { branchSlug: "b", fileBoundaries: ["src\\shared.ts"] },
  ]);
  expect(out).toEqual([{ a: "a", b: "b", overlap: ["src/shared.ts"] }]);
});

test("ignora planes con fronteras vacías", () => {
  expect(
    checkBoundaryOverlaps([
      { branchSlug: "a", fileBoundaries: [] },
      { branchSlug: "b", fileBoundaries: ["x.ts"] },
    ]),
  ).toEqual([]);
});
