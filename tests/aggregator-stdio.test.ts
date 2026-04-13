import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listAllResources } from "../src/aggregator/list-resources.js";
import { sennitConfigSchema } from "../src/config/schema.js";
import { firstTextBlock } from "./mcp-helpers.js";
import { withInMemoryAggregator } from "./test-utils.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("createAggregator (stdio upstream)", () => {
  it("proxies mock tools and forwards echo inputSchema for the host catalog", async () => {
    const mockPath = join(root, "dist", "fixtures", "mock-upstream.js");
    await withInMemoryAggregator(
      sennitConfigSchema.parse({
        version: 1,
        servers: {
          mock: {
            transport: "stdio",
            command: process.execPath,
            args: [mockPath],
          },
        },
      }),
      async (client) => {
        const { tools } = await client.listTools();
        expect(tools.some((t) => t.name === "mock__mock.ping")).toBe(true);
        const echo = tools.find((t) => t.name === "mock__mock.echo");
        expect(echo?.inputSchema).toMatchObject({
          type: "object",
          properties: expect.objectContaining({
            msg: expect.objectContaining({ type: "string" }),
          }),
        });

        const ping = await client.callTool({
          name: "mock__mock.ping",
          arguments: {},
        });
        expect(firstTextBlock(ping)).toBe("pong");

        const resources = await listAllResources(client);
        const readme = resources.find((r) => r.name === "mock__mock.readme");
        expect(readme?.uri).toMatch(/^urn:sennit:resource:v1:/);
        const read = await client.readResource({ uri: readme!.uri });
        const text = read.contents.find((c) => "text" in c) as { text: string } | undefined;
        expect(text?.text).toContain("# mock");
      },
    );
  });
});
