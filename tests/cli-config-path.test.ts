import { describe, expect, it } from "vitest";
import { runCli } from "./run-cli.js";

describe("CLI config path", () => {
  it("prints one line ending with config.yaml", () => {
    const { code, stdout } = runCli(["config", "path"]);
    expect(code).toBe(0);
    expect(stdout.trim().endsWith("config.yaml")).toBe(true);
    expect(stdout.split("\n").length).toBe(2);
  });
});
