import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SennitConfig } from "../config/schema.js";
import { runWithHostMcpAsync } from "../lib/active-host-mcp.js";
import { withAbortTimeout } from "../lib/with-timeout.js";
import type { UpstreamHub } from "./upstream-hub.js";
import type { RemovableRegistration } from "./register-proxied-surface.js";

const aliasInputSchema = z.record(z.string(), z.unknown()).optional();

export function registerAliasTools(
  mcp: McpServer,
  hub: UpstreamHub,
  config: SennitConfig,
): RemovableRegistration[] {
  const aliases = config.aliases ?? {};
  const handles: RemovableRegistration[] = [];
  for (const [aliasName, target] of Object.entries(aliases)) {
    const description =
      target.description ??
      `Alias for ${JSON.stringify(target.serverKey)} upstream tool ${JSON.stringify(target.toolName)}.`;
    const h = mcp.registerTool(
      aliasName,
      { description, inputSchema: aliasInputSchema },
      async (args) =>
        runWithHostMcpAsync(mcp, async () => {
          const timeoutMs = config.servers[target.serverKey]?.toolCallTimeoutMs;
          const call = (signal?: AbortSignal) =>
            hub.callTool(
              target.serverKey,
              {
                name: target.toolName,
                arguments: (args as Record<string, unknown>) ?? {},
              },
              { signal },
            );
          return timeoutMs !== undefined
            ? withAbortTimeout(timeoutMs, (signal) => call(signal))
            : call(undefined);
        }),
    );
    handles.push(h);
  }
  return handles;
}
