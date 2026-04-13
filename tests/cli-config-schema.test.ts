import { describe, expect, it } from "vitest";
import { runCli } from "./run-cli.js";

describe("CLI config schema", () => {
  it("prints JSON Schema with $schema and properties.version", () => {
    const { code, stdout } = runCli(["config", "schema"]);
    expect(code).toBe(0);
    const j = JSON.parse(stdout) as { type?: string; properties?: { version?: unknown } };
    expect(j.properties?.version).toBeDefined();
  });

  it("wraps with --wrap", () => {
    const { code, stdout } = runCli(["config", "schema", "--wrap"]);
    expect(code).toBe(0);
    const j = JSON.parse(stdout) as {
      schemaVersion: number;
      jsonSchema: { properties?: { version?: unknown } };
    };
    expect(j.schemaVersion).toBe(1);
    expect(j.jsonSchema.properties?.version).toBeDefined();
  });
});
