import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Forwards upstream `notifications/tools/list_changed` interest to the host via
 * {@link McpServer.sendToolListChanged} when `dynamicToolList` is enabled in config.
 *
 * The merged registrations are still fixed at connect time; hosts that re-call `tools/list`
 * see the same catalog until reconnect. This hook exists so UIs can react when upstreams signal changes.
 */
export type UpstreamToolListChangedBridge = {
  signalHostToolListChanged: () => void;
};

export function makeUpstreamToolListChangedBridge(mcp: McpServer): UpstreamToolListChangedBridge {
  return {
    signalHostToolListChanged: () => {
      try {
        mcp.sendToolListChanged();
      } catch {
        // Host not connected or prompts-only surface
      }
    },
  };
}
