import { describe, expect, it } from "vitest";
import { runCli } from "./run-cli.js";

describe("CLI version", () => {
  it("prints version lines by default", () => {
    const { code, stdout } = runCli(["version"]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/^Sennit /m);
    expect(stdout).toMatch(/^node v/m);
  });

  it("prints JSON with --json", () => {
    const { code, stdout } = runCli(["version", "--json"]);
    expect(code).toBe(0);
    const j = JSON.parse(stdout) as {
      schemaVersion: number;
      name: string;
      version: string;
      node: string;
    };
    expect(j.schemaVersion).toBe(1);
    expect(j.name).toBe("sennit");
    expect(j.version.length).toBeGreaterThan(0);
    expect(j.node).toMatch(/^v/);
  });
});
