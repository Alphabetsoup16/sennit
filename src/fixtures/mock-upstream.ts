/**
 * Minimal MCP server for integration tests: `mock.ping`, `mock.echo`.
 * Run: `node dist/fixtures/mock-upstream.js` (after `npm run build`).
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

async function main(): Promise<void> {
  const mcp = new McpServer(
    { name: "mock-upstream", version: "0.0.1" },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  mcp.registerPrompt(
    "mock.greet",
    {
      description: "Builds a greeting user message.",
      argsSchema: { name: z.string() },
    },
    async ({ name }) => ({
      messages: [
        {
          role: "user",
          content: { type: "text", text: `Please greet ${name} kindly.` },
        },
      ],
    }),
  );

  mcp.registerResource(
    "mock.readme",
    "file:///mock/readme.md",
    { description: "Fixture resource for integration tests.", mimeType: "text/markdown" },
    async () => ({
      contents: [{ uri: "file:///mock/readme.md", text: "# mock\n" }],
    }),
  );

  mcp.registerResource(
    "mock.dynamic",
    new ResourceTemplate("file:///mock/dynamic/{name}", { list: undefined }),
    { description: "Template for files under file:///mock/dynamic/", mimeType: "text/plain" },
    async (_uri, variables) => {
      const name = String(variables.name ?? "");
      const uri = `file:///mock/dynamic/${name}`;
      return { contents: [{ uri, text: `dynamic:${name}` }] };
    },
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
