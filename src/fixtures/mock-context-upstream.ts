/**
 * Stdio MCP server for host-context regression tests:
 * - `mock.rootsSnapshot` calls `listRoots()`
 * - `mock.sampleIdentity` calls `sampling/createMessage`
 * - `mock.elicitIdentity` calls `elicitation/create`
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { jsonText } from "../lib/json-text.js";

async function main(): Promise<void> {
  const mcp = new McpServer(
    { name: "mock-context-upstream", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  mcp.registerTool("mock.rootsSnapshot", { description: "Returns client roots snapshot." }, async () => {
    const r = await mcp.server.listRoots();
    return { content: [{ type: "text", text: jsonText(r.roots ?? []) }] };
  });

  mcp.registerTool("mock.sampleIdentity", { description: "Returns host sampling identity." }, async () => {
    const out = await mcp.server.createMessage({
      messages: [{ role: "user", content: { type: "text", text: "identity?" } }],
      maxTokens: 16,
    });
    const text = out.content.type === "text" ? out.content.text : JSON.stringify(out.content);
    return { content: [{ type: "text", text }] };
  });

  mcp.registerTool("mock.elicitIdentity", { description: "Returns host elicitation identity." }, async () => {
    const out = await mcp.server.elicitInput({
      message: "identity?",
      requestedSchema: {
        type: "object",
        properties: { who: { type: "string" } },
        required: ["who"],
      },
    });
    return { content: [{ type: "text", text: jsonText(out) }] };
  });

  await mcp.connect(new StdioServerTransport());
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
