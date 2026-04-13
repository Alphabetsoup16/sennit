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
    expect(c.servers.a).toMatchObject({ transport: "stdio", command: "node" });
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

  it("accepts streamableHttp server", () => {
    const c = sennitConfigSchema.parse({
      version: 1,
      servers: {
        r: { transport: "streamableHttp", url: "https://mcp.example.com/v1" },
      },
    });
    expect(c.servers.r).toMatchObject({
      transport: "streamableHttp",
      url: "https://mcp.example.com/v1",
    });
  });

  it("accepts sse server and http tuning fields", () => {
    const c = sennitConfigSchema.parse({
      version: 1,
      servers: {
        legacy: {
          transport: "sse",
          url: "https://old.example/mcp",
          httpRequestTimeoutMs: 12_000,
        },
        http: {
          transport: "streamableHttp",
          url: "https://mcp.example.com/v1",
          httpRequestTimeoutMs: 8000,
          streamableHttpReconnection: { maxRetries: 5 },
        },
      },
    });
    expect(c.servers.legacy.transport).toBe("sse");
    if (c.servers.http.transport === "streamableHttp") {
      expect(c.servers.http.streamableHttpReconnection?.maxRetries).toBe(5);
    }
  });

  it("accepts roots.mapByUpstream", () => {
    const c = sennitConfigSchema.parse({
      version: 1,
      servers: {},
      roots: {
        mode: "forward",
        mapByUpstream: { a: [{ fromPrefix: "file:///x/", toPrefix: "file:///y/" }] },
      },
    });
    expect(c.roots.mapByUpstream?.a).toHaveLength(1);
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
    expect(c.servers.t).toMatchObject({ transport: "stdio", command: "echo" });
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
    expect(c.servers.j).toMatchObject({ transport: "stdio", command: "node" });
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
    expect(c.servers.t).toMatchObject({ transport: "stdio", command: "whoami" });
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
    expect(c.servers.x).toMatchObject({ transport: "stdio", command: "sh" });
    rmSync(dir, { recursive: true, force: true });
  });
});
