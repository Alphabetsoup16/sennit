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
        expect(stdout).toContain("mock__mock.readme");
        expect(stdout).toMatch(/1 resources/);
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
          mergedResources: Array<{ name: string; uri: string }>;
          inspect: { upstreams: unknown[] };
        };
        expect(j.schemaVersion).toBe(1);
        expect(j.inspect.upstreams).toEqual([]);
        expect(j.mergedTools.map((t) => t.name)).toContain("sennit.batch_call");
        expect(j.mergedResources).toEqual([]);
      },
    );
  });

  it("lists namespaced tools from two healthy mock upstreams", async () => {
    const mock = distMockUpstreamPath();
    await withTempYamlConfig(
      {
        version: 1,
        servers: {
          a: {
            transport: "stdio",
            command: process.execPath,
            args: [mock],
          },
          b: {
            transport: "stdio",
            command: process.execPath,
            args: [mock],
          },
        },
      },
      async (path) => {
        const { code, stdout } = runCli(["plan", "-c", path, "--timeout", "15000"]);
        expect(code).toBe(0);
        expect(stdout).toContain("a__mock.ping");
        expect(stdout).toContain("b__mock.ping");
        expect(stdout).toContain("a__mock.readme");
        expect(stdout).toContain("b__mock.readme");
      },
    );
  });

  it("JSON plan reports two ok upstreams with merged tools", async () => {
    const mock = distMockUpstreamPath();
    await withTempYamlConfig(
      {
        version: 1,
        servers: {
          a: {
            transport: "stdio",
            command: process.execPath,
            args: [mock],
          },
          b: {
            transport: "stdio",
            command: process.execPath,
            args: [mock],
          },
        },
      },
      async (path) => {
        const { code, stdout } = runCli(["plan", "-c", path, "--timeout", "15000", "--json"]);
        expect(code).toBe(0);
        const j = JSON.parse(stdout) as {
          inspect: {
            ok: boolean;
            upstreams: Array<{ serverKey: string; ok: boolean }>;
          };
          mergedTools: Array<{ name: string }>;
        };
        expect(j.inspect.ok).toBe(true);
        expect(j.inspect.upstreams).toHaveLength(2);
        expect(j.inspect.upstreams.every((u) => u.ok)).toBe(true);
        const names = j.mergedTools.map((t) => t.name);
        expect(names).toContain("a__mock.ping");
        expect(names).toContain("b__mock.ping");
      },
    );
  });
});
