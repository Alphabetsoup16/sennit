import { describe, expect, it } from "vitest";
import { firstTextBlock } from "./mcp-helpers.js";
import { withInMemoryAggregator } from "./test-utils.js";

describe("createAggregator (in-memory)", () => {
  it("exposes sennit.meta and sennit.batch_call with no upstreams", async () => {
    await withInMemoryAggregator({ version: 1, servers: {} }, async (client) => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).sort();
      expect(names).toContain("sennit.meta");
      expect(names).toContain("sennit.batch_call");

      const meta = await client.callTool({ name: "sennit.meta", arguments: {} });
      expect(firstTextBlock(meta)).toContain("sennitVersion");
    });
  });

  it("batch_call returns structured results for unknown server", async () => {
    await withInMemoryAggregator({ version: 1, servers: {} }, async (client) => {
      const out = await client.callTool({
        name: "sennit.batch_call",
        arguments: {
          calls: [
            {
              serverKey: "nope",
              toolName: "x",
              clientCallId: "1",
            },
          ],
        },
      });
      const parsed = JSON.parse(firstTextBlock(out)) as Array<{
        ok: boolean;
        error?: string;
      }>;
      expect(parsed[0]?.ok).toBe(false);
      expect(parsed[0]?.error).toMatch(/unknown serverKey/);
    });
  });
});
