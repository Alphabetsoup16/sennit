import { describe, expect, it } from "vitest";
import { runCli } from "./run-cli.js";

describe("CLI completion", () => {
  it("prints bash script", () => {
    const { code, stdout } = runCli(["completion", "bash"]);
    expect(code).toBe(0);
    expect(stdout).toContain("complete -F _sennit sennit");
    expect(stdout).toContain("plan");
  });

  it("exits 1 for unknown shell", () => {
    const { code, stderr } = runCli(["completion", "pwsh"]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/unknown shell/i);
  });
});
