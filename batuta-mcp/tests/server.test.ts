import { test, expect } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server";
import { FakeRunner } from "../src/lib/runner";
import type { RunResult } from "../src/types";

async function connect(responses: RunResult[] = []) {
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const server = createServer({ runner: new FakeRunner(responses) });
  await server.connect(serverT);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientT);
  return client;
}

test("expone exactamente las 3 tools", async () => {
  const client = await connect();
  const tools = (await client.listTools()).tools.map((t) => t.name).sort();
  expect(tools).toEqual([
    "check_boundary_overlaps",
    "decompose_into_plans",
    "scaffold_worktrees",
  ]);
});

test("check_boundary_overlaps devuelve structuredContent", async () => {
  const client = await connect();
  const res = await client.callTool({
    name: "check_boundary_overlaps",
    arguments: {
      plans: [
        { branchSlug: "a", fileBoundaries: ["x.ts"] },
        { branchSlug: "b", fileBoundaries: ["x.ts"] },
      ],
    },
  });
  expect((res.structuredContent as { ok: boolean }).ok).toBe(false);
});

test("decompose_into_plans devuelve isError cuando no hay planes", async () => {
  const client = await connect([{ code: 0, stdout: "no json", stderr: "" }]);
  const res = await client.callTool({
    name: "decompose_into_plans",
    arguments: { brainDump: "x" },
  });
  expect(res.isError).toBe(true);
});
