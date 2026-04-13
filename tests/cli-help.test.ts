import { describe, expect, it } from "vitest";
import { runCli } from "./run-cli.js";

describe("CLI help", () => {
  it("shows root usage for help with no args", () => {
    const { code, stdout } = runCli(["help"]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/Usage:\s*sennit/i);
    expect(stdout).toMatch(/doctor/i);
  });

  it("shows subcommand usage for help doctor", () => {
    const { code, stdout } = runCli(["help", "doctor"]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/doctor/i);
  });
});
