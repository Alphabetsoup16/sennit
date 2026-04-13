import { describe, expect, it } from "vitest";
import { UpstreamHub } from "../src/aggregator/upstream-hub.js";
import { runDoctorInspect } from "../src/cli/inspect-upstreams.js";
import type { SennitConfig } from "../src/config/schema.js";
import { sennitConfigSchema } from "../src/config/schema.js";

class NeverFinishesConnectHub extends UpstreamHub {
  override async connect(_config: SennitConfig): Promise<void> {
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
});
