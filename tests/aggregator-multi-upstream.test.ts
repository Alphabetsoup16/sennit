import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listAllResources } from "../src/aggregator/list-resources.js";
import { sennitConfigSchema } from "../src/config/schema.js";
import { firstTextBlock } from "./mcp-helpers.js";
import { withInMemoryAggregator } from "./test-utils.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function mockUpstreamPath(): string {
  return join(root, "dist", "fixtures", "mock-upstream.js");
}

describe("createAggregator (multi stdio upstream)", () => {
  it("merges distinct serverKey__tool names from two live upstreams", async () => {
    const path = mockUpstreamPath();
    const config = sennitConfigSchema.parse({
      version: 1,
      servers: {
        alpha: { transport: "stdio", command: process.execPath, args: [path] },
        beta: { transport: "stdio", command: process.execPath, args: [path] },
      },
    });

    await withInMemoryAggregator(config, async (client) => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).sort();
      expect(names).toContain("alpha__mock.ping");
      expect(names).toContain("beta__mock.ping");
      expect(names.filter((n) => n.includes("mock.ping")).length).toBe(2);
    });
  });

  it("sennit.batch_call fans out to two serverKeys in one round-trip", async () => {
    const path = mockUpstreamPath();
    const config = sennitConfigSchema.parse({
      version: 1,
      servers: {
        east: { transport: "stdio", command: process.execPath, args: [path] },
        west: { transport: "stdio", command: process.execPath, args: [path] },
      },
    });

    await withInMemoryAggregator(config, async (client) => {
      const out = await client.callTool({
        name: "sennit.batch_call",
        arguments: {
          calls: [
            { serverKey: "east", toolName: "mock.ping", clientCallId: "c1" },
            { serverKey: "west", toolName: "mock.ping", clientCallId: "c2" },
          ],
        },
      });

      const rows = JSON.parse(firstTextBlock(out)) as Array<{
        clientCallId: string;
        ok: boolean;
        result?: { content: Array<{ text?: string }> };
      }>;

      expect(rows).toHaveLength(2);
      const byId = Object.fromEntries(rows.map((r) => [r.clientCallId, r]));
      expect(byId.c1?.ok).toBe(true);
      expect(byId.c2?.ok).toBe(true);
      expect(byId.c1?.result?.content?.[0]?.text).toBe("pong");
      expect(byId.c2?.result?.content?.[0]?.text).toBe("pong");
    });
  });

  it("merges resources from both upstreams with distinct façade URIs", async () => {
    const path = mockUpstreamPath();
    const config = sennitConfigSchema.parse({
      version: 1,
      servers: {
        a: { transport: "stdio", command: process.execPath, args: [path] },
        b: { transport: "stdio", command: process.execPath, args: [path] },
      },
    });

    await withInMemoryAggregator(config, async (client) => {
      const resources = await listAllResources(client);
      const names = resources.map((r) => r.name).sort();
      expect(names).toEqual(["a__mock.readme", "b__mock.readme"]);
      const uris = new Set(resources.map((r) => r.uri));
      expect(uris.size).toBe(2);
      for (const u of uris) {
        expect(u).toMatch(/^urn:sennit:resource:v1:/);
      }
    });
  });
});
