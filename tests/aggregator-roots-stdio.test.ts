import { describe, expect, it } from "vitest";
import type { Root } from "@modelcontextprotocol/sdk/types.js";
import { firstTextBlock } from "./mcp-helpers.js";
import { distMockRootsUpstreamPath } from "./cli-fixtures.js";
import { withInMemoryAggregatorAndHostRoots, withInMemoryAggregator } from "./test-utils.js";

describe("aggregator roots (stdio upstream + host roots)", () => {
  it("forward mode returns host roots from upstream snapshot tool", async () => {
    const hostRoots: Root[] = [
      { uri: "file:///project/a", name: "a" },
      { uri: "file:///project/b", name: "b" },
    ];
    await withInMemoryAggregatorAndHostRoots(
      {
        version: 1,
        roots: { mode: "forward" },
        servers: {
          mock: {
            transport: "stdio",
            command: process.execPath,
            args: [distMockRootsUpstreamPath()],
          },
        },
      },
      hostRoots,
      async (client) => {
        const out = await client.callTool({
          name: "mock__mock.rootsSnapshot",
          arguments: {},
        });
        expect(out.isError).not.toBe(true);
        const parsed = JSON.parse(firstTextBlock(out)) as Root[];
        expect(parsed).toEqual(hostRoots);
      },
    );
  });

  it("intersect mode filters host roots by allowUriPrefixes", async () => {
    const hostRoots: Root[] = [
      { uri: "file:///allowed/x", name: "x" },
      { uri: "file:///other/y", name: "y" },
    ];
    await withInMemoryAggregatorAndHostRoots(
      {
        version: 1,
        roots: { mode: "intersect", allowUriPrefixes: ["file:///allowed/"] },
        servers: {
          mock: {
            transport: "stdio",
            command: process.execPath,
            args: [distMockRootsUpstreamPath()],
          },
        },
      },
      hostRoots,
      async (client) => {
        const out = await client.callTool({
          name: "mock__mock.rootsSnapshot",
          arguments: {},
        });
        expect(out.isError).not.toBe(true);
        const parsed = JSON.parse(firstTextBlock(out)) as Root[];
        expect(parsed).toEqual([{ uri: "file:///allowed/x", name: "x" }]);
      },
    );
  });

  it("ignore mode: upstream listRoots fails without client roots capability on Sennit", async () => {
    await withInMemoryAggregator(
      {
        version: 1,
        roots: { mode: "ignore" },
        servers: {
          mock: {
            transport: "stdio",
            command: process.execPath,
            args: [distMockRootsUpstreamPath()],
          },
        },
      },
      async (client) => {
        const out = await client.callTool({
          name: "mock__mock.rootsSnapshot",
          arguments: {},
        });
        expect(out.isError).toBe(true);
      },
    );
  });
});
