import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Root } from "@modelcontextprotocol/sdk/types.js";
import type { RootsPolicy, SennitConfig } from "../config/schema.js";

/** Bridges host roots into upstream-facing `roots/list` responses (see `UpstreamHub`). */
export type UpstreamRootsBridge = {
  policy: RootsPolicy;
  getHostRoots: () => Promise<Root[]>;
};

/**
 * When `roots.mode` is not `ignore`, upstream servers may call `roots/list` on Sennit’s
 * upstream MCP clients. Responses use the **host** (`mcp.server.listRoots()`) plus
 * `applyRootsPolicy` from `roots-policy.ts`.
 */
export function makeUpstreamRootsBridge(
  config: SennitConfig,
  mcp: McpServer,
): UpstreamRootsBridge | undefined {
  const policy = config.roots;
  if (policy.mode === "ignore") {
    return undefined;
  }
  return {
    policy,
    getHostRoots: async () => {
      try {
        const r = await mcp.server.listRoots();
        return r.roots ?? [];
      } catch {
        return [];
      }
    },
  };
}
