import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REDACTED_VALUE } from "../src/cli/config-redact.js";
import { runCli } from "./run-cli.js";
import { withTempYamlConfig } from "./cli-fixtures.js";

describe("CLI config print", () => {
  it("redacts env in YAML output", async () => {
    await withTempYamlConfig(
      {
        version: 1,
        servers: {
          x: {
            transport: "stdio",
            command: "node",
            args: ["a.js"],
            env: { TOKEN: "super-secret" },
          },
        },
      },
      async (path) => {
        const { code, stdout } = runCli(["config", "print", "-c", path]);
        expect(code).toBe(0);
        expect(stdout).toContain(REDACTED_VALUE);
        expect(stdout).not.toContain("super-secret");
      },
    );
  });

  it("prints JSON with configPath and redacted env", async () => {
    await withTempYamlConfig(
      {
        version: 1,
        servers: {
          x: { transport: "stdio", command: "true", args: [], env: { K: "v" } },
        },
      },
      async (path) => {
        const { code, stdout } = runCli(["config", "print", "-c", path, "--json"]);
        expect(code).toBe(0);
        const j = JSON.parse(stdout) as {
          schemaVersion: number;
          configPath: string;
          config: { servers: { x: { env: Record<string, string> } } };
        };
        expect(j.schemaVersion).toBe(1);
        expect(j.configPath).toBe(path);
        expect(j.config.servers.x.env.K).toBe(REDACTED_VALUE);
      },
    );
  });

  it("prints schema default with --empty --json", () => {
    const { code, stdout } = runCli(["config", "print", "--empty", "--json"]);
    expect(code).toBe(0);
    const j = JSON.parse(stdout) as {
      configPath: null;
      config: { version: number; servers: Record<string, never> };
    };
    expect(j.configPath).toBeNull();
    expect(j.config.version).toBe(1);
    expect(j.config.servers).toEqual({});
  });

  it("exits 1 when --empty is combined with -c", () => {
    const { code, stderr } = runCli([
      "config",
      "print",
      "--empty",
      "-c",
      "/tmp/will-not-read.yaml",
    ]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/Cannot use --empty/);
  });

  it("with no file resolved prints empty servers in JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "sennit-print-empty-"));
    try {
      const { code, stdout } = runCli(["config", "print", "--json"], { cwd: dir });
      expect(code).toBe(0);
      const j = JSON.parse(stdout) as {
        configPath: null;
        config: { version: number; servers: Record<string, never> };
      };
      expect(j.configPath).toBeNull();
      expect(j.config.version).toBe(1);
      expect(j.config.servers).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
