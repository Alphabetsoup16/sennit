/**
 * Stdio MCP server with `mock.rootsSnapshot`: calls `Server.listRoots()` toward the client.
 * Run: `node dist/fixtures/mock-roots-upstream.js` (after `npm run build`).
 */
import { jsonText } from "../lib/json-text.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main(): Promise<void> {
  const mcp = new McpServer(
    { name: "mock-roots-upstream", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  mcp.registerTool(
    "mock.rootsSnapshot",
    {
      description: "Calls listRoots toward the connected MCP client and returns JSON roots.",
    },
    async () => {
      const r = await mcp.server.listRoots();
      return {
        content: [{ type: "text", text: jsonText(r.roots ?? []) }],
      };
    },
  );

  await mcp.connect(new StdioServerTransport());
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
