import { describe, expect, it } from "vitest";
import { runCli } from "./run-cli.js";
import { distMockUpstreamPath, withTempYamlConfig } from "./cli-fixtures.js";

describe("CLI doctor inspect", () => {
  it("exits 1 for invalid --timeout", () => {
    const { code, stderr } = runCli(["doctor", "inspect", "--timeout", "0"]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/invalid --timeout/i);
  });

  it("lists tools from mock stdio upstream", async () => {
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
        const { code, stdout } = runCli(["doctor", "inspect", "-c", path, "--timeout", "15000"]);
        expect(code).toBe(0);
        expect(stdout).toContain("mock:");
        expect(stdout).toMatch(/mock\.ping/);
      },
    );
  });

  it("prints JSON with upstream toolNames", async () => {
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
        const { code, stdout } = runCli([
          "doctor",
          "inspect",
          "-c",
          path,
          "--json",
          "--timeout",
          "15000",
        ]);
        expect(code).toBe(0);
        const j = JSON.parse(stdout) as {
          schemaVersion: number;
          ok: boolean;
          configPath: string;
          upstreams: Array<{ serverKey: string; toolNames: string[] }>;
        };
        expect(j.schemaVersion).toBe(1);
        expect(j.ok).toBe(true);
        expect(j.configPath).toBe(path);
        const mock = j.upstreams.find((u) => u.serverKey === "mock");
        expect(mock?.toolNames).toContain("mock.ping");
      },
    );
  });
});
