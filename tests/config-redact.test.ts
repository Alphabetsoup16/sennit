import { describe, expect, it } from "vitest";
import { sennitConfigSchema } from "../src/config/schema.js";
import { REDACTED_VALUE, redactSennitConfig } from "../src/cli/config-redact.js";

describe("redactSennitConfig", () => {
  it("replaces all env values but preserves keys", () => {
    const c = sennitConfigSchema.parse({
      version: 1,
      servers: {
        a: {
          transport: "stdio",
          command: "node",
          args: ["x.js"],
          env: { SECRET: "hunter2", OTHER: "x" },
        },
      },
    });
    const r = redactSennitConfig(c);
    expect(r.servers.a.env).toEqual({ SECRET: REDACTED_VALUE, OTHER: REDACTED_VALUE });
    expect(r.servers.a.command).toBe("node");
  });

  it("leaves servers without env unchanged", () => {
    const c = sennitConfigSchema.parse({
      version: 1,
      servers: { b: { transport: "stdio", command: "true", args: [] } },
    });
    const r = redactSennitConfig(c);
    expect(r.servers.b.env).toBeUndefined();
  });

  it("redacts roots.allowUriPrefixes entries", () => {
    const c = sennitConfigSchema.parse({
      version: 1,
      servers: {},
      roots: {
        mode: "intersect",
        allowUriPrefixes: ["file:///secret/path", "file:///other"],
      },
    });
    const r = redactSennitConfig(c);
    expect(r.roots.allowUriPrefixes).toEqual([REDACTED_VALUE, REDACTED_VALUE]);
  });
});
