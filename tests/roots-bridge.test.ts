import { describe, expect, it, vi } from "vitest";
import { makeUpstreamRootsBridge } from "../src/aggregator/roots-bridge.js";
import { sennitConfigSchema } from "../src/config/schema.js";

describe("makeUpstreamRootsBridge", () => {
  const mcp = {
    server: {
      listRoots: vi.fn().mockResolvedValue({ roots: [{ uri: "file:///x", name: "n" }] }),
    },
  };

  it("returns undefined when roots.mode is ignore", () => {
    const cfg = sennitConfigSchema.parse({
      version: 1,
      servers: {},
      roots: { mode: "ignore" },
    });
    expect(makeUpstreamRootsBridge(cfg, mcp as never)).toBeUndefined();
  });

  it("returns bridge that reads host roots when mode is forward", async () => {
    const cfg = sennitConfigSchema.parse({
      version: 1,
      servers: {},
      roots: { mode: "forward" },
    });
    const bridge = makeUpstreamRootsBridge(cfg, mcp as never);
    expect(bridge).toBeDefined();
    const roots = await bridge!.getHostRoots();
    expect(roots).toEqual([{ uri: "file:///x", name: "n" }]);
    expect(mcp.server.listRoots).toHaveBeenCalledOnce();
  });

  it("getHostRoots yields empty list when listRoots throws", async () => {
    const mcpThrow = {
      server: { listRoots: vi.fn().mockRejectedValue(new Error("no roots")) },
    };
    const cfg = sennitConfigSchema.parse({
      version: 1,
      servers: {},
      roots: { mode: "forward" },
    });
    const bridge = makeUpstreamRootsBridge(cfg, mcpThrow as never);
    expect(bridge).toBeDefined();
    await expect(bridge!.getHostRoots()).resolves.toEqual([]);
    expect(bridge!.lastHostRootsError).toBe("no roots");
  });

  it("clears lastHostRootsError after a successful listRoots", async () => {
    let call = 0;
    const mcp = {
      server: {
        listRoots: vi.fn().mockImplementation(async () => {
          call += 1;
          if (call === 1) throw new Error("first fail");
          return { roots: [{ uri: "file:///ok", name: "n" }] };
        }),
      },
    };
    const cfg = sennitConfigSchema.parse({
      version: 1,
      servers: {},
      roots: { mode: "forward" },
    });
    const bridge = makeUpstreamRootsBridge(cfg, mcp as never)!;
    await bridge.getHostRoots();
    expect(bridge.lastHostRootsError).toBe("first fail");
    const second = await bridge.getHostRoots();
    expect(second).toEqual([{ uri: "file:///ok", name: "n" }]);
    expect(bridge.lastHostRootsError).toBeUndefined();
  });
});
