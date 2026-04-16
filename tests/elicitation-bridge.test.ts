import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ElicitRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { makeUpstreamElicitationBridge } from "../src/aggregator/elicitation-bridge.js";
import { runWithHostMcpAsync } from "../src/lib/active-host-mcp.js";
import { VERSION } from "../src/lib/version.js";

describe("makeUpstreamElicitationBridge", () => {
  it("forwards elicitation/create to the connected host client", async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const mcp = new McpServer(
      { name: "test-facade", version: VERSION },
      { capabilities: { tools: {} } },
    );
    const bridge = makeUpstreamElicitationBridge();

    const hostClient = new Client(
      { name: "host", version: "1.0.0" },
      { capabilities: { elicitation: { form: {} } } },
    );
    hostClient.setRequestHandler(ElicitRequestSchema, async (req) => {
      if (req.params.mode === "url") {
        return { action: "decline" as const };
      }
      return { action: "accept" as const, content: { ok: true } };
    });

    await mcp.connect(serverSide);
    await hostClient.connect(clientSide);
    try {
      const out = await runWithHostMcpAsync(mcp, () =>
        bridge.forwardElicit({
          message: "confirm?",
          requestedSchema: {
            type: "object",
            properties: { ok: { type: "boolean", title: "OK" } },
          },
        }),
      );
      expect(out).toMatchObject({ action: "accept", content: { ok: true } });
    } finally {
      await hostClient.close();
      await mcp.close();
    }
  });

  it("maps missing host elicitation capability to InvalidParams", async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const mcp = new McpServer(
      { name: "test-facade", version: VERSION },
      { capabilities: { tools: {} } },
    );
    const bridge = makeUpstreamElicitationBridge();

    const hostClient = new Client({ name: "host", version: "1.0.0" }, { capabilities: {} });
    await mcp.connect(serverSide);
    await hostClient.connect(clientSide);
    try {
      await expect(
        runWithHostMcpAsync(mcp, () =>
          bridge.forwardElicit({
            message: "confirm?",
            requestedSchema: {
              type: "object",
              properties: { x: { type: "string" } },
            },
          }),
        ),
      ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
    } finally {
      await hostClient.close();
      await mcp.close();
    }
  });

  it("maps MethodNotFound McpError to InvalidParams", async () => {
    const mcp = new McpServer(
      { name: "test-facade", version: VERSION },
      { capabilities: { tools: {} } },
    );
    const bridge = makeUpstreamElicitationBridge();
    const spy = vi.spyOn(mcp.server, "elicitInput").mockRejectedValue(
      new McpError(ErrorCode.MethodNotFound, "custom-reason"),
    );
    try {
      await expect(
        runWithHostMcpAsync(mcp, () =>
          bridge.forwardElicit({
            message: "confirm?",
            requestedSchema: {
              type: "object",
              properties: { x: { type: "string" } },
            },
          }),
        ),
      ).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
    } finally {
      spy.mockRestore();
      await mcp.close();
    }
  });
});
