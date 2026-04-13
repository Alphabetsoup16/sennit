import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { UpstreamHub } from "../src/aggregator/upstream-hub.js";
import { sennitConfigSchema } from "../src/config/schema.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("UpstreamHub", () => {
  it("closes successful connections when a later upstream fails to connect", async () => {
    const mockPath = join(root, "dist", "fixtures", "mock-upstream.js");
    const hub = new UpstreamHub();
    const config = sennitConfigSchema.parse({
      version: 1,
      servers: {
        first: {
          transport: "stdio",
          command: process.execPath,
          args: [mockPath],
        },
        second: {
          transport: "stdio",
          command: "/nonexistent/sennit-upstream-connect-fail",
          args: [],
        },
      },
    });

    await expect(hub.connect(config)).rejects.toThrow();
    expect(hub.get("first")).toBeUndefined();
    await hub.close();
  });

  it("does not spawn upstreams when connect signal is already aborted", async () => {
    const hub = new UpstreamHub();
    const config = sennitConfigSchema.parse({
      version: 1,
      servers: {
        only: {
          transport: "stdio",
          command: process.execPath,
          args: ["-e", "setInterval(() => {}, 1<<30)"],
        },
      },
    });
    await expect(hub.connect(config, { signal: AbortSignal.abort() })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(hub.serverKeys()).toEqual([]);
    await hub.close();
  });
});
