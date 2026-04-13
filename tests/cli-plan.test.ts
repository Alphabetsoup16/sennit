import { describe, expect, it } from "vitest";
import { runCli } from "./run-cli.js";
import { distMockUpstreamPath, withTempYamlConfig } from "./cli-fixtures.js";

describe("CLI plan", () => {
  it("exits 0 with mock upstream and lists merged tools", async () => {
    await withTempYamlConfig(
      {
        version: 1,
        servers: {
          mock: {
            transport: "stdio",
            command: process.execPath,
            args: [distMockUpstreamPath()],
          },
        },
      },
      async (path) => {
        const { code, stdout } = runCli(["plan", "-c", path, "--timeout", "15000"]);
        expect(code).toBe(0);
        expect(stdout).toContain("Upstream reachability");
        expect(stdout).toContain("Merged tool catalog");
        expect(stdout).toContain("mock__mock.ping");
        expect(stdout).toMatch(/status:\s*ok/);
      },
    );
  });

  it("prints JSON with inspect and mergedTools", async () => {
    await withTempYamlConfig(
      { version: 1, servers: {} },
      async (path) => {
        const { code, stdout } = runCli(["plan", "-c", path, "--json"]);
        expect(code).toBe(0);
        const j = JSON.parse(stdout) as {
          schemaVersion: number;
          mergedTools: Array<{ name: string }>;
          inspect: { upstreams: unknown[] };
        };
        expect(j.schemaVersion).toBe(1);
        expect(j.inspect.upstreams).toEqual([]);
        expect(j.mergedTools.map((t) => t.name)).toContain("sennit.batch_call");
      },
    );
  });
});
