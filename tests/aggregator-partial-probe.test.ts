import { describe, expect, it } from "vitest";
import { createAggregator } from "../src/aggregator/build-server.js";
import { sennitConfigSchema } from "../src/config/schema.js";
import { distMockListToolsFailPath, distMockUpstreamPath } from "./cli-fixtures.js";

describe("createAggregator (partial upstream probe)", () => {
  it("rejects when any upstream tools/list fails", async () => {
    const config = sennitConfigSchema.parse({
      version: 1,
      servers: {
        good: {
          transport: "stdio",
          command: process.execPath,
          args: [distMockUpstreamPath()],
        },
        bad: {
          transport: "stdio",
          command: process.execPath,
          args: [distMockListToolsFailPath()],
        },
      },
    });
    await expect(createAggregator(config)).rejects.toThrow(/intentional tools\/list failure/);
  });
});
