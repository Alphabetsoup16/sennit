import type { Root } from "@modelcontextprotocol/sdk/types.js";
import type { RootsPolicy, SennitConfig } from "../config/schema.js";
import { getActiveHostMcp } from "../lib/active-host-mcp.js";
import { errorMessage } from "../lib/error-message.js";

/** Bridges host roots into upstream-facing `roots/list` responses (see `UpstreamHub`). */
export type UpstreamRootsBridge = {
  policy: RootsPolicy;
  getHostRoots: () => Promise<Root[]>;
  /** After a failed host `listRoots`, holds `Error#message` (cleared on success). */
  lastHostRootsError?: string;
};

/**
 * When `roots.mode` is not `ignore`, upstream servers may call `roots/list` on Sennit’s
 * upstream MCP clients. Responses use the **host** (`mcp.server.listRoots()`) plus
 * `applyRootsPolicy` from `roots-policy.ts`.
 */
export function makeUpstreamRootsBridge(config: SennitConfig): UpstreamRootsBridge | undefined {
  const policy = config.roots;
  if (policy.mode === "ignore") {
    return undefined;
  }
  const bridge: UpstreamRootsBridge = {
    policy,
    getHostRoots: async () => {
      bridge.lastHostRootsError = undefined;
      const mcp = getActiveHostMcp();
      if (!mcp) {
        bridge.lastHostRootsError =
          "no active host MCP session (connect a client; roots forward uses the host that invoked proxied work)";
        return [];
      }
      try {
        const r = await mcp.server.listRoots();
        return r.roots ?? [];
      } catch (e) {
        bridge.lastHostRootsError = errorMessage(e);
        return [];
      }
    },
  };
  return bridge;
}
