import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Forwards upstream list-changed notifications to the host `McpServer` when the matching
 * `dynamic*` config flags are enabled. Merged registrations stay fixed until the host reconnects.
 */
export type UpstreamHostListChangedBridge = {
  signalHostToolListChanged: () => void;
  signalHostResourceListChanged: () => void;
  signalHostPromptListChanged: () => void;
};

function signalOrIgnore(send: () => void): void {
  try {
    send();
  } catch {
    /* host disconnected */
  }
}

export function makeUpstreamHostListChangedBridge(mcp: McpServer): UpstreamHostListChangedBridge {
  return {
    signalHostToolListChanged: () => signalOrIgnore(() => mcp.sendToolListChanged()),
    signalHostResourceListChanged: () => signalOrIgnore(() => mcp.sendResourceListChanged()),
    signalHostPromptListChanged: () => signalOrIgnore(() => mcp.sendPromptListChanged()),
  };
}
