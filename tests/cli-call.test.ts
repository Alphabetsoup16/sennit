import { describe, expect, it } from "vitest";
import { runCli } from "./run-cli.js";
import { distMockUpstreamPath, withTempYamlConfig } from "./cli-fixtures.js";

describe("CLI call", () => {
  it("invokes a merged tool and prints JSON", async () => {
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
          "call",
          "mock__mock.ping",
          "-c",
          path,
        ]);
        expect(code).toBe(0);
        const j = JSON.parse(stdout) as { content: Array<{ text?: string }> };
        expect(j.content?.[0]?.text).toBe("pong");
      },
    );
  });

  it("exits 1 for invalid --args JSON", async () => {
    await withTempYamlConfig({ version: 1, servers: {} }, async (path) => {
      const { code } = runCli(["call", "sennit.meta", "-c", path, "--args", "{"]);
      expect(code).toBe(1);
    });
  });
});
