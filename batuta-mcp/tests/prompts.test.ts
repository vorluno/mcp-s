import { test, expect } from "bun:test";
import {
  buildDecomposePrompt,
  buildFixOverlapsPrompt,
  buildPlanPrompt,
} from "../src/lib/prompts";

test("decompose incluye brain dump, pide JSON y fronteras disjuntas", () => {
  const p = buildDecomposePrompt("hacer login y reporte", "Next.js");
  expect(p).toContain("hacer login y reporte");
  expect(p.toLowerCase()).toContain("json");
  expect(p.toLowerCase()).toContain("disjoint");
  expect(p).toContain("Next.js");
});

test("fix-overlaps menciona los solapes a separar", () => {
  const plans = [
    { title: "A", specMd: "", fileBoundaries: ["x.ts"], branchSlug: "a" },
    { title: "B", specMd: "", fileBoundaries: ["x.ts"], branchSlug: "b" },
  ];
  const p = buildFixOverlapsPrompt("dump", plans, [{ a: "a", b: "b", overlap: ["x.ts"] }]);
  expect(p).toContain("x.ts");
  expect(p.toLowerCase()).toContain("overlap");
});

test("plan prompt incluye título, fronteras y es agnóstico sin hint", () => {
  const p = buildPlanPrompt(
    { title: "Login", specMd: "## Goal\nlogin", fileBoundaries: ["src/auth.ts"], branchSlug: "login" },
  );
  expect(p).toContain("Login");
  expect(p).toContain("src/auth.ts");
  expect(p.toLowerCase()).toContain("test");
});
