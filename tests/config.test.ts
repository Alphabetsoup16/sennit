import { describe, expect, it } from "vitest";
import { loadConfigFile } from "../src/config/load.js";
import { sennitConfigSchema } from "../src/config/schema.js";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("sennitConfigSchema", () => {
  it("accepts minimal config", () => {
    const c = sennitConfigSchema.parse({ version: 1, servers: {} });
    expect(c.servers).toEqual({});
  });

  it("accepts stdio server", () => {
    const c = sennitConfigSchema.parse({
      version: 1,
      servers: {
        a: { transport: "stdio", command: "node", args: ["a.js"] },
      },
    });
    expect(c.servers.a.command).toBe("node");
  });
});

describe("loadConfigFile", () => {
  it("loads yaml from disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "sennit-"));
    const path = join(dir, "cfg.yaml");
    writeFileSync(
      path,
      `version: 1\nservers:\n  t:\n    transport: stdio\n    command: echo\n`,
      "utf8",
    );
    const c = loadConfigFile(path);
    expect(c.servers.t.command).toBe("echo");
    rmSync(dir, { recursive: true, force: true });
  });
});
