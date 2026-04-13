import { describe, expect, it } from "vitest";
import { loadConfigFile } from "../src/config/load.js";
import { tryLoadSennitConfig } from "../src/cli/load-config.js";
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

  it("defaults roots to ignore when omitted", () => {
    const c = sennitConfigSchema.parse({ version: 1, servers: {} });
    expect(c.roots).toEqual({ mode: "ignore" });
  });

  it('requires allowUriPrefixes when roots.mode is "intersect"', () => {
    expect(() =>
      sennitConfigSchema.parse({
        version: 1,
        servers: {},
        roots: { mode: "intersect" },
      }),
    ).toThrow(/allowUriPrefixes/);
  });

  it("rejects server keys containing __", () => {
    expect(() =>
      sennitConfigSchema.parse({
        version: 1,
        servers: {
          "bad__key": { transport: "stdio", command: "echo" },
        },
      }),
    ).toThrow(/server key must not contain/);
  });

  it("accepts optional servers.*.resources allowlist", () => {
    const c = sennitConfigSchema.parse({
      version: 1,
      servers: {
        a: {
          transport: "stdio",
          command: "node",
          resources: ["file:///x"],
        },
      },
    });
    expect(c.servers.a.resources).toEqual(["file:///x"]);
  });
});

describe("tryLoadSennitConfig", () => {
  it("returns config when valid (single parse)", () => {
    const dir = mkdtempSync(join(tmpdir(), "sennit-tryload-"));
    const path = join(dir, "ok.yaml");
    writeFileSync(path, "version: 1\nservers: {}\n", "utf8");
    const r = tryLoadSennitConfig(path);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.version).toBe(1);
      expect(r.config.servers).toEqual({});
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns error for invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "sennit-bad-"));
    const path = join(dir, "bad.json");
    writeFileSync(path, '{ "version": 1, }', "utf8");
    const r = tryLoadSennitConfig(path);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
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

  it("loads json from disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "sennit-json-"));
    const path = join(dir, "cfg.json");
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        servers: { j: { transport: "stdio", command: "node", args: ["x.js"] } },
      }),
      "utf8",
    );
    const c = loadConfigFile(path);
    expect(c.servers.j.command).toBe("node");
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses extensionless file as YAML first", () => {
    const dir = mkdtempSync(join(tmpdir(), "sennit-extless-"));
    const path = join(dir, "cfg");
    writeFileSync(
      path,
      `version: 1\nservers:\n  t:\n    transport: stdio\n    command: whoami\n`,
      "utf8",
    );
    const c = loadConfigFile(path);
    expect(c.servers.t.command).toBe("whoami");
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses extensionless file as JSON when YAML parse fails", () => {
    const dir = mkdtempSync(join(tmpdir(), "sennit-extless-json-"));
    const path = join(dir, "cfg");
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        servers: { x: { transport: "stdio", command: "sh", args: ["-c", "true"] } },
      }),
      "utf8",
    );
    const c = loadConfigFile(path);
    expect(c.servers.x.command).toBe("sh");
    rmSync(dir, { recursive: true, force: true });
  });
});
