import { test, expect } from "bun:test";
import { detectStack, type RepoReader } from "../src/lib/stack-detect";

function reader(files: string[], globs: string[] = []): RepoReader {
  return {
    has: (rel) => Promise.resolve(files.includes(rel)),
    hasGlob: (pattern) => Promise.resolve(globs.includes(pattern)),
  };
}

test("detecta Node por package.json", async () => {
  expect(await detectStack(reader(["package.json"]))).toContain("Node.js");
});

test("detecta .NET por *.csproj", async () => {
  expect(await detectStack(reader([], ["**/*.csproj"]))).toContain(".NET");
});

test("detecta Go y Python", async () => {
  expect(await detectStack(reader(["go.mod"]))).toContain("Go");
  expect(await detectStack(reader(["pyproject.toml"]))).toContain("Python");
});

test("devuelve undefined si no reconoce nada", async () => {
  expect(await detectStack(reader([]))).toBeUndefined();
});
