/**
 * MCP stdio server that fails `tools/list` after a normal handshake.
 * Run: `node dist/fixtures/mock-listtools-fail.js` (after `npm run build`).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";

async function main(): Promise<void> {
  const server = new Server(
    { name: "mock-listtools-fail", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    throw new McpError(ErrorCode.InternalError, "intentional tools/list failure");
  });
  await server.connect(new StdioServerTransport());
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
