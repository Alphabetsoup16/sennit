/**
 * Minimal MCP server for integration tests: one tool `mock.ping` → text "pong".
 * Run: `node dist/fixtures/mock-upstream.js` (after `npm run build`).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main(): Promise<void> {
  const mcp = new McpServer(
    { name: "mock-upstream", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  mcp.registerTool(
    "mock.ping",
    { description: "Returns pong." },
    async () => ({
      content: [{ type: "text", text: "pong" }],
    }),
  );

  await mcp.connect(new StdioServerTransport());
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
