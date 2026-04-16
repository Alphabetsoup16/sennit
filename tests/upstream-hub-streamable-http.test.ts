import { describe, expect, it } from "vitest";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { sennitConfigSchema } from "../src/config/schema.js";
import { HostListChangedFanout } from "../src/aggregator/host-list-changed-bridge.js";
import { UpstreamHub } from "../src/aggregator/upstream-hub.js";

describe("UpstreamHub streamableHttp", () => {
  it("connects to a minimal Streamable HTTP MCP server and lists tools", async () => {
    // Stateful sessions: the client opens GET SSE then POSTs JSON-RPC; a stateless transport only allows one request.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    const mcp = new McpServer(
      { name: "streamable-fixture", version: "0.0.1" },
      { capabilities: { tools: {} } },
    );
    mcp.registerTool("fixture.ping", { description: "ping" }, async () => ({
      content: [{ type: "text", text: "pong" }],
    }));
    await mcp.connect(transport);

    const server = http.createServer((req, res) => {
      void transport.handleRequest(req, res);
    });

    const baseUrl = await new Promise<string>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr !== null) {
          resolve(`http://127.0.0.1:${addr.port}/mcp`);
        } else {
          reject(new Error("no listen address"));
        }
      });
      server.on("error", reject);
    });

    const hub = new UpstreamHub(new HostListChangedFanout());
    try {
      await hub.connect(
        sennitConfigSchema.parse({
          version: 1,
          servers: {
            fx: {
              transport: "streamableHttp",
              url: baseUrl,
            },
          },
        }),
      );
      const client = await hub.ensureClient("fx");
      expect(client).toBeDefined();
      const { tools } = await client!.listTools();
      expect(tools.map((t) => t.name)).toContain("fixture.ping");
    } finally {
      await hub.close().catch(() => undefined);
      await mcp.close().catch(() => undefined);
      await transport.close().catch(() => undefined);
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
