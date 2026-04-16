import { describe, expect, it } from "vitest";
import {
  importServersFromHostMcpJson,
  importStdioServersFromHostMcpJson,
  looksLikeSennitServe,
} from "../src/cli/import-host-mcp.js";

describe("importStdioServersFromHostMcpJson", () => {
  it("imports stdio servers from mcpServers", () => {
    const { servers, skipped } = importStdioServersFromHostMcpJson({
      mcpServers: {
        alpha: { command: "node", args: ["a.js"] },
        beta: { command: "uvx", args: ["pkg@1", "run"], env: { FOO: "bar" } },
      },
    });
    expect(skipped).toEqual([]);
    expect(servers.alpha).toEqual({
      transport: "stdio",
      command: "node",
      args: ["a.js"],
    });
    expect(servers.beta?.env).toEqual({ FOO: "bar" });
  });

  it("skips entries without command", () => {
    const { servers, skipped } = importStdioServersFromHostMcpJson({
      mcpServers: { empty: {} },
    });
    expect(Object.keys(servers)).toHaveLength(0);
    expect(skipped.some((s) => s.key === "empty" && /command/i.test(s.reason))).toBe(
      true,
    );
  });

  it("does not include url entries in stdio-only import", () => {
    const { servers, skipped } = importStdioServersFromHostMcpJson({
      mcpServers: {
        hybrid: { command: "npx", args: ["x"], url: "https://x" },
      },
    });
    expect(servers.hybrid).toBeUndefined();
    expect(skipped).toEqual([]);
  });

  it("skips likely Sennit aggregator to avoid nesting", () => {
    const { servers, skipped } = importStdioServersFromHostMcpJson({
      mcpServers: {
        sennit: {
          command: "npx",
          args: ["-y", "sennit", "serve", "--config", "/tmp/c.yaml"],
        },
      },
    });
    expect(servers.sennit).toBeUndefined();
    expect(skipped[0]?.reason).toMatch(/Sennit/);
  });

  it("reports missing mcpServers", () => {
    const { servers, skipped } = importStdioServersFromHostMcpJson({});
    expect(servers).toEqual({});
    expect(skipped[0]?.reason).toMatch(/mcpServers/);
  });
});

describe("importServersFromHostMcpJson", () => {
  it("imports streamableHttp for url entries", () => {
    const { servers, skipped } = importServersFromHostMcpJson({
      mcpServers: {
        remote: {
          url: "https://example.com/mcp",
          headers: { Authorization: "Bearer xyz" },
          httpRequestTimeoutMs: 2500,
        },
      },
    });
    expect(skipped).toEqual([]);
    expect(servers.remote).toEqual({
      transport: "streamableHttp",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer xyz" },
      httpRequestTimeoutMs: 2500,
    });
  });

  it("imports sse when entry transport is sse", () => {
    const { servers, skipped } = importServersFromHostMcpJson({
      mcpServers: {
        legacy: {
          transport: "sse",
          url: "https://example.com/sse",
        },
      },
    });
    expect(skipped).toEqual([]);
    expect(servers.legacy).toEqual({
      transport: "sse",
      url: "https://example.com/sse",
    });
  });
});

describe("looksLikeSennitServe", () => {
  it("detects npx sennit serve", () => {
    expect(looksLikeSennitServe("npx", ["-y", "sennit", "serve"])).toBe(true);
  });

  it("does not flag unrelated commands", () => {
    expect(looksLikeSennitServe("npx", ["-y", "other-pkg", "serve"])).toBe(false);
  });
});
