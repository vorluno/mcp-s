import { test, expect } from "bun:test";
import { parseDecomposition, decomposeIntoPlans } from "../src/tools/decompose";
import { FakeRunner } from "../src/lib/runner";
import type { RunResult } from "../src/types";

const cliEnvelope = (text: string): RunResult => ({
  code: 0,
  stdout: JSON.stringify([{ type: "result", result: text }]),
  stderr: "",
});

test("parseDecomposition extrae el array aunque venga con prosa/fences", () => {
  const inner = 'Here you go: ```json\n[{"title":"A","fileBoundaries":["a.ts"],"branchSlug":"a"}]\n``` done';
  const plans = parseDecomposition(JSON.stringify([{ type: "result", result: inner }]));
  expect(plans).toEqual([{ title: "A", specMd: "", fileBoundaries: ["a.ts"], branchSlug: "a" }]);
});

test("parseDecomposition devuelve [] ante basura", () => {
  expect(parseDecomposition("no json here")).toEqual([]);
});

test("sin solape: una sola llamada, attempts=1", async () => {
  const disjoint = '[{"title":"A","fileBoundaries":["a.ts"],"branchSlug":"a"},{"title":"B","fileBoundaries":["b.ts"],"branchSlug":"b"}]';
  const runner = new FakeRunner([cliEnvelope(disjoint)]);
  const res = await decomposeIntoPlans({ brainDump: "x" }, { runner });
  expect(res.attempts).toBe(1);
  expect(res.overlapsResolved).toBe(true);
  expect(res.plans.length).toBe(2);
  expect(runner.calls.length).toBe(1);
});

test("con solape: reintenta una vez y resuelve, attempts=2", async () => {
  const overlap = '[{"title":"A","fileBoundaries":["x.ts"],"branchSlug":"a"},{"title":"B","fileBoundaries":["x.ts"],"branchSlug":"b"}]';
  const fixed = '[{"title":"A","fileBoundaries":["a.ts"],"branchSlug":"a"},{"title":"B","fileBoundaries":["b.ts"],"branchSlug":"b"}]';
  const runner = new FakeRunner([cliEnvelope(overlap), cliEnvelope(fixed)]);
  const res = await decomposeIntoPlans({ brainDump: "x" }, { runner });
  expect(res.attempts).toBe(2);
  expect(res.overlapsResolved).toBe(true);
  expect(runner.calls.length).toBe(2);
});

test("usa projectHint en el prompt", async () => {
  const runner = new FakeRunner([cliEnvelope("[]")]);
  await decomposeIntoPlans({ brainDump: "x", projectHint: "Rust" }, { runner });
  expect(runner.calls[0]!.cmd.join(" ")).toContain("Rust");
});
