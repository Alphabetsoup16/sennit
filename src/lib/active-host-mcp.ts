import { AsyncLocalStorage } from "node:async_hooks";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const storage = new AsyncLocalStorage<McpServer>();

/** Fallback when upstream calls (e.g. roots/list) outside an active tool/prompt handler. */
let lastActiveHostMcp: McpServer | undefined;

/**
 * Binds the host-facing {@link McpServer} for the current async chain so upstream
 * sampling/elicitation/roots bridges can forward to the correct HTTP (or stdio) session.
 */
export function runWithHostMcpAsync<T>(mcp: McpServer, fn: () => Promise<T>): Promise<T> {
  lastActiveHostMcp = mcp;
  return storage.run(mcp, fn);
}

export function getActiveHostMcp(): McpServer | undefined {
  return storage.getStore() ?? lastActiveHostMcp;
}

/** Current async-context host MCP only (no fallback). */
export function getCurrentHostMcp(): McpServer | undefined {
  return storage.getStore();
}

export function setLastActiveHostMcpForTests(mcp: McpServer | undefined): void {
  lastActiveHostMcp = mcp;
}
