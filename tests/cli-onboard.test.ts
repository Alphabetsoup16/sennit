import { describe, expect, it } from "vitest";
import { runCli } from "./run-cli.js";

describe("CLI onboard", () => {
  it("prints host mcpServers snippet as JSON", () => {
    const { code, stdout } = runCli(["onboard"]);
    expect(code).toBe(0);
    expect(stdout).toContain("mcpServers");
    expect(stdout).toContain("serve");
    const start = stdout.indexOf("{");
    expect(start).toBeGreaterThanOrEqual(0);
    const j = JSON.parse(stdout.slice(start)) as {
      mcpServers: { sennit: { command: string; args: string[] } };
    };
    expect(j.mcpServers.sennit.command).toBe("npx");
    expect(j.mcpServers.sennit.args).toContain("serve");
  });
});
