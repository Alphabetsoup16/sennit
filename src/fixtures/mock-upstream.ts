/**
 * Minimal MCP server for integration tests: `mock.ping`, `mock.echo`.
 * Run: `node dist/fixtures/mock-upstream.js` (after `npm run build`).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

async function main(): Promise<void> {
  const mcp = new McpServer(
    { name: "mock-upstream", version: "0.0.1" },
    { capabilities: { tools: {}, resources: {} } },
  );

  mcp.registerResource(
    "mock.readme",
    "file:///mock/readme.md",
    { description: "Fixture resource for integration tests.", mimeType: "text/markdown" },
    async () => ({
      contents: [{ uri: "file:///mock/readme.md", text: "# mock\n" }],
    }),
  );

  mcp.registerTool(
    "mock.ping",
    { description: "Returns pong." },
    async () => ({
      content: [{ type: "text", text: "pong" }],
    }),
  );

  mcp.registerTool(
    "mock.echo",
    {
      description: "Echoes msg.",
      inputSchema: { msg: z.string() },
    },
    async ({ msg }) => ({
      content: [{ type: "text", text: msg }],
    }),
  );

  await mcp.connect(new StdioServerTransport());
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
