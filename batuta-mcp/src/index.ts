import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";
import { bunRunner } from "./lib/runner";
import { detectStackFs } from "./lib/stack-detect";
import { setVerbose, logger } from "./lib/logger";

async function main(): Promise<void> {
  if (process.argv.includes("--verbose")) setVerbose(true);
  const server = createServer({ runner: bunRunner, detectStack: detectStackFs });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("batuta-mcp running on stdio");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error in batuta-mcp:", err);
    process.exit(1);
  });
}
