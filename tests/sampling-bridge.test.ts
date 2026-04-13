import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateMessageRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { makeUpstreamSamplingBridge } from "../src/aggregator/sampling-bridge.js";
import { VERSION } from "../src/lib/version.js";

describe("makeUpstreamSamplingBridge", () => {
  it("forwards createMessage to the connected host client", async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const mcp = new McpServer(
      { name: "test-facade", version: VERSION },
      { capabilities: { tools: {} } },
    );
    const bridge = makeUpstreamSamplingBridge(mcp);

    const hostClient = new Client(
      { name: "host", version: "1.0.0" },
      { capabilities: { sampling: {} } },
    );
    hostClient.setRequestHandler(CreateMessageRequestSchema, async (req) => ({
      role: "assistant",
      model: "test-model",
      content: { type: "text", text: `echo:${String(req.params.maxTokens)}` },
      stopReason: "endTurn" as const,
    }));

    await mcp.connect(serverSide);
    await hostClient.connect(clientSide);
    try {
      const out = await bridge.forwardCreateMessage({
        messages: [{ role: "user", content: { type: "text", text: "hi" } }],
        maxTokens: 42,
      });
      expect(out).toMatchObject({
        role: "assistant",
        model: "test-model",
        content: { type: "text", text: "echo:42" },
        stopReason: "endTurn",
      });
    } finally {
      await hostClient.close();
      await mcp.close();
    }
  });

  it("maps missing host sampling capability to InvalidParams", async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const mcp = new McpServer(
      { name: "test-facade", version: VERSION },
      { capabilities: { tools: {} } },
    );
    const bridge = makeUpstreamSamplingBridge(mcp);

    const hostClient = new Client({ name: "host", version: "1.0.0" }, { capabilities: {} });
    await mcp.connect(serverSide);
    await hostClient.connect(clientSide);
    try {
      await expect(
        bridge.forwardCreateMessage({
          messages: [{ role: "user", content: { type: "text", text: "hi" } }],
          maxTokens: 10,
        }),
      ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
    } finally {
      await hostClient.close();
      await mcp.close();
    }
  });

  it("maps MethodNotFound McpError without Method not found text to InvalidParams", async () => {
    const mcp = new McpServer(
      { name: "test-facade", version: VERSION },
      { capabilities: { tools: {} } },
    );
    const bridge = makeUpstreamSamplingBridge(mcp);
    const spy = vi.spyOn(mcp.server, "createMessage").mockRejectedValue(
      new McpError(ErrorCode.MethodNotFound, "custom-reason"),
    );
    try {
      await expect(
        bridge.forwardCreateMessage({
          messages: [{ role: "user", content: { type: "text", text: "hi" } }],
          maxTokens: 10,
        }),
      ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
    } finally {
      spy.mockRestore();
      await mcp.close();
    }
  });
});
