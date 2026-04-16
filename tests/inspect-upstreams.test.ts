import { describe, expect, it } from "vitest";
import { HostListChangedFanout } from "../src/aggregator/host-list-changed-bridge.js";
import type { UpstreamHubConnectOptions } from "../src/aggregator/upstream-hub.js";
import { UpstreamHub } from "../src/aggregator/upstream-hub.js";
import { runDoctorInspect } from "../src/cli/inspect-upstreams.js";
import type { SennitConfig } from "../src/config/schema.js";
import { sennitConfigSchema } from "../src/config/schema.js";
import { distMockListToolsFailPath, distMockUpstreamPath } from "./cli-fixtures.js";

class NeverFinishesConnectHub extends UpstreamHub {
  constructor() {
    super(new HostListChangedFanout());
  }

  override async connect(
    _config: SennitConfig,
    _options?: UpstreamHubConnectOptions,
  ): Promise<void> {
    await new Promise<void>(() => {});
  }
}

describe("runDoctorInspect", () => {
  it("returns ok with no upstreams", async () => {
    const config = sennitConfigSchema.parse({ version: 1, servers: {} });
    const r = await runDoctorInspect(config, 5000);
    expect(r.schemaVersion).toBe(1);
    expect(r.ok).toBe(true);
    expect(r.fatalError).toBeUndefined();
    expect(r.upstreams).toEqual([]);
  });

  it("returns fatalError when overall timeout is exceeded", async () => {
    const config = sennitConfigSchema.parse({ version: 1, servers: {} });
    const r = await runDoctorInspect(config, 80, { hub: new NeverFinishesConnectHub() });
    expect(r.ok).toBe(false);
    expect(r.fatalError).toMatch(/timed out after 80ms/);
    expect(r.upstreams).toEqual([]);
  });

  it("returns fatalError when connect fails", async () => {
    const config = sennitConfigSchema.parse({
      version: 1,
      servers: {
        bad: {
          transport: "stdio",
          command: "/nonexistent/sennit-binary-xyz",
          args: [],
        },
      },
    });
    const r = await runDoctorInspect(config, 5000);
    expect(r.ok).toBe(false);
    expect(r.fatalError).toBeDefined();
    expect(r.upstreams).toEqual([]);
  });

  it("reports per-upstream tools/list failure without fatalError", async () => {
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
    const r = await runDoctorInspect(config, 15_000);
    expect(r.fatalError).toBeUndefined();
    expect(r.ok).toBe(false);
    expect(r.upstreams).toHaveLength(2);
    const good = r.upstreams.find((u) => u.serverKey === "good");
    const bad = r.upstreams.find((u) => u.serverKey === "bad");
    expect(good?.ok).toBe(true);
    expect(bad?.ok).toBe(false);
    if (bad && bad.ok === false) {
      expect(bad.error).toMatch(/intentional tools\/list failure/);
    }
  });
});
