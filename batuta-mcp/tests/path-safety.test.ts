import { test, expect } from "bun:test";
import { isBoundarySafe, unsafeBoundaries } from "../src/lib/path-safety";

test("acepta rutas relativas dentro del repo", () => {
  expect(isBoundarySafe("src/a.ts")).toBe(true);
  expect(isBoundarySafe("docs/")).toBe(true);
});

test("rechaza escapes y rutas absolutas", () => {
  expect(isBoundarySafe("../secrets.ts")).toBe(false);
  expect(isBoundarySafe("a/../../b")).toBe(false);
  expect(isBoundarySafe("/etc/passwd")).toBe(false);
  expect(isBoundarySafe("C:\\Windows")).toBe(false);
});

test("permite dots no-segmento y rechaza vacío", () => {
  expect(isBoundarySafe("a..b")).toBe(true);
  expect(isBoundarySafe("src/v1.2/x.ts")).toBe(true);
  expect(isBoundarySafe("")).toBe(false);
});

test("unsafeBoundaries reporta plan + frontera ofensora", () => {
  expect(
    unsafeBoundaries([
      { branchSlug: "ok", fileBoundaries: ["src/a.ts"] },
      { branchSlug: "bad", fileBoundaries: ["src/b.ts", "../x"] },
    ]),
  ).toEqual([{ branchSlug: "bad", boundary: "../x" }]);
});
