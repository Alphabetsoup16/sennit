import { describe, expect, it } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("MCP SDK dynamic registration capabilities", () => {
  it("registerTool returns handle with remove/disable/enable", () => {
    const mcp = new McpServer(
      { name: "sdk-audit", version: "0.0.1" },
      { capabilities: { tools: {} } },
    );
    const handle = mcp.registerTool(
      "audit.tool",
      { description: "audit tool" },
      async () => ({ content: [{ type: "text", text: "ok" }] }),
    );
    expect(typeof handle.remove).toBe("function");
    expect(typeof handle.disable).toBe("function");
    expect(typeof handle.enable).toBe("function");
  });

  it("registerPrompt and registerResource return removable handles", () => {
    const mcp = new McpServer(
      { name: "sdk-audit", version: "0.0.1" },
      { capabilities: { tools: {} } },
    );
    const prompt = mcp.registerPrompt("audit.prompt", { description: "audit prompt" }, async () => ({
      messages: [],
    }));
    const resource = mcp.registerResource(
      "audit.resource",
      "urn:audit:resource",
      { description: "audit resource" },
      async () => ({ contents: [{ uri: "urn:audit:resource", text: "ok" }] }),
    );
    expect(typeof prompt.remove).toBe("function");
    expect(typeof prompt.disable).toBe("function");
    expect(typeof prompt.enable).toBe("function");
    expect(typeof resource.remove).toBe("function");
    expect(typeof resource.disable).toBe("function");
    expect(typeof resource.enable).toBe("function");
  });
});
