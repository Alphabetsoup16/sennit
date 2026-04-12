import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAggregator } from "../src/aggregator/build-server.js";
import { firstTextBlock } from "./mcp-helpers.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("createAggregator (stdio upstream)", () => {
  it("proxies mock.ping as mock__mock.ping", async () => {
    const mockPath = join(root, "dist", "fixtures", "mock-upstream.js");
    const hubConfig = {
      version: 1 as const,
      servers: {
        mock: {
          transport: "stdio" as const,
          command: process.execPath,
          args: [mockPath],
        },
      },
    };

    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const { mcp, close } = await createAggregator(hubConfig);
    await mcp.connect(serverSide);
    const client = new Client(
      { name: "it-client", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(clientSide);
    try {
      const { tools } = await client.listTools();
      expect(tools.some((t) => t.name === "mock__mock.ping")).toBe(true);

      const ping = await client.callTool({
        name: "mock__mock.ping",
        arguments: {},
      });
      expect(firstTextBlock(ping)).toBe("pong");
    } finally {
      await client.close();
      await close();
    }
  });
});
