import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sennitConfigSchema } from "../src/config/schema.js";
import { planOverallOk, runPlan } from "../src/cli/plan-run.js";
import { distMockListToolsFailPath } from "./cli-fixtures.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("runPlan", () => {
  it("succeeds with no upstreams (meta + batch only)", async () => {
    const config = sennitConfigSchema.parse({ version: 1, servers: {} });
    const r = await runPlan(null, config, 5000);
    expect(r.schemaVersion).toBe(1);
    expect(r.inspect.upstreams).toEqual([]);
    expect(r.mergedError).toBeUndefined();
    const names = (r.mergedTools ?? []).map((t) => t.name).sort();
    expect(names).toContain("sennit.meta");
    expect(names).toContain("sennit.batch_call");
    expect(r.mergedResources).toEqual([]);
    expect(planOverallOk(r)).toBe(true);
  });

  it("includes namespaced tools for mock stdio upstream", async () => {
    const mockPath = join(root, "dist", "fixtures", "mock-upstream.js");
    const config = sennitConfigSchema.parse({
      version: 1,
      servers: {
        mock: {
          transport: "stdio",
          command: process.execPath,
          args: [mockPath],
        },
      },
    });
    const r = await runPlan(null, config, 15_000);
    expect(r.inspect.upstreams.some((u) => u.serverKey === "mock" && u.ok)).toBe(true);
    expect(r.inspect.upstreams.find((u) => u.serverKey === "mock")?.resourceCount).toBe(1);
    const names = (r.mergedTools ?? []).map((t) => t.name);
    expect(names).toContain("mock__mock.ping");
    const resNames = (r.mergedResources ?? []).map((x) => x.name);
    expect(resNames).toContain("mock__mock.readme");
    expect(planOverallOk(r)).toBe(true);
  });

  it("sets mergedError when one upstream tools/list fails", async () => {
    const mockPath = join(root, "dist", "fixtures", "mock-upstream.js");
    const config = sennitConfigSchema.parse({
      version: 1,
      servers: {
        good: {
          transport: "stdio",
          command: process.execPath,
          args: [mockPath],
        },
        bad: {
          transport: "stdio",
          command: process.execPath,
          args: [distMockListToolsFailPath()],
        },
      },
    });
    const r = await runPlan(null, config, 15_000);
    expect(r.inspect.fatalError).toBeUndefined();
    expect(r.inspect.ok).toBe(false);
    expect(r.mergedError).toMatch(/intentional tools\/list failure/);
    expect(r.mergedTools).toBeUndefined();
    expect(planOverallOk(r)).toBe(false);
  });
});
