import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SennitConfig } from "../config/schema.js";
import { runWithHostMcpAsync } from "../lib/active-host-mcp.js";
import { errorMessage } from "../lib/error-message.js";
import { takeUniqueMergedToolId, TOOL_NAMESPACE_SEPARATOR } from "../lib/namespace.js";
import { sennitJsonLog } from "../lib/sennit-json-log.js";
import { withAbortTimeout } from "../lib/with-timeout.js";
import { truncateForToolList } from "../lib/truncate-tool-description.js";
import { zodShapeFromPromptArguments } from "./prompt-args-from-listing.js";
import { proxyToolInputSchema } from "./proxy-input-schema.js";
import type { UpstreamHub } from "./upstream-hub.js";

type ListedTool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];
type ListedPrompt = Awaited<ReturnType<Client["listPrompts"]>>["prompts"][number];
export type RemovableRegistration = { remove: () => void };

export async function registerProxiedTools(
  mcp: McpServer,
  hub: UpstreamHub,
  config: SennitConfig,
  upstreamToolCatalogs: Array<{ serverKey: string; tools: ListedTool[] }>,
): Promise<RemovableRegistration[]> {
  const seen = new Set<string>();
  const handles: RemovableRegistration[] = [];
  for (const { serverKey, tools } of upstreamToolCatalogs) {
    const allow = config.servers[serverKey]?.tools;

    for (const tool of tools) {
      if (allow && !allow.includes(tool.name)) {
        continue;
      }

      const full = takeUniqueMergedToolId(seen, serverKey, tool.name);

      const rawDescription =
        tool.description ?? `Proxied from upstream "${serverKey}" (tool: ${tool.name}).`;

      const h = mcp.registerTool(
        full,
        {
          description: truncateForToolList(rawDescription, config.toolsListDescriptionMaxChars),
          inputSchema: proxyToolInputSchema(tool.inputSchema),
        },
        async (args) =>
          runWithHostMcpAsync(mcp, async () => {
            const t0 = Date.now();
            try {
              const timeoutMs = config.servers[serverKey]?.toolCallTimeoutMs;
              const out =
                timeoutMs !== undefined
                  ? await withAbortTimeout(timeoutMs, (signal) =>
                      hub.callTool(
                        serverKey,
                        {
                          name: tool.name,
                          arguments: (args as Record<string, unknown>) ?? {},
                        },
                        { signal },
                      ),
                    )
                  : await hub.callTool(serverKey, {
                      name: tool.name,
                      arguments: (args as Record<string, unknown>) ?? {},
                    });
              sennitJsonLog("tool_proxy_ok", {
                serverKey,
                tool: tool.name,
                ms: Date.now() - t0,
              });
              hub.touchActivity(serverKey);
              return out as CallToolResult;
            } catch (e) {
              sennitJsonLog("tool_proxy_err", {
                serverKey,
                tool: tool.name,
                ms: Date.now() - t0,
                error: errorMessage(e),
              });
              throw e;
            }
          }),
      );
      handles.push(h);
    }
  }
  return handles;
}

export async function registerProxiedPrompts(
  mcp: McpServer,
  hub: UpstreamHub,
  config: SennitConfig,
  upstreamPromptCatalogs: Array<{ serverKey: string; prompts: ListedPrompt[] }>,
): Promise<RemovableRegistration[]> {
  const seenPrompts = new Set<string>();
  const handles: RemovableRegistration[] = [];
  for (const { serverKey, prompts } of upstreamPromptCatalogs) {
    const allow = config.servers[serverKey]?.prompts;

    for (const prompt of prompts) {
      if (allow && !allow.includes(prompt.name)) {
        continue;
      }

      const full = takeUniqueMergedToolId(seenPrompts, serverKey, prompt.name);
      const shape = zodShapeFromPromptArguments(prompt);
      const description =
        prompt.description ?? `Proxied from upstream "${serverKey}" (prompt: ${prompt.name}).`;

      if (Object.keys(shape).length === 0) {
        const h = mcp.registerPrompt(
          full,
          { description, title: prompt.title },
          async () =>
            runWithHostMcpAsync(mcp, async () => {
              const c = await hub.ensureClient(serverKey);
              if (!c) {
                return {
                  messages: [
                    {
                      role: "user",
                      content: { type: "text", text: `upstream missing: ${serverKey}` },
                    },
                  ],
                };
              }
              const r = await c.getPrompt({ name: prompt.name, arguments: {} });
              hub.touchActivity(serverKey);
              return r;
            }),
        );
        handles.push(h);
      } else {
        const h = mcp.registerPrompt(
          full,
          { description, title: prompt.title, argsSchema: shape },
          async (args) =>
            runWithHostMcpAsync(mcp, async () => {
              const c = await hub.ensureClient(serverKey);
              if (!c) {
                return {
                  messages: [
                    {
                      role: "user",
                      content: { type: "text", text: `upstream missing: ${serverKey}` },
                    },
                  ],
                };
              }
              const stringArgs = Object.fromEntries(
                Object.entries(args as Record<string, unknown>)
                  .filter(([, v]) => v !== undefined && v !== null)
                  .map(([k, v]) => [k, String(v)]),
              ) as Record<string, string>;
              const r = await c.getPrompt({
                name: prompt.name,
                arguments: stringArgs,
              });
              hub.touchActivity(serverKey);
              return r;
            }),
        );
        handles.push(h);
      }
    }
  }
  return handles;
}

/** For `sennit.meta` text only. */
export function proxiedNamespacingRuleSummary(): string {
  return `Proxied tools and prompts use {serverKey}${TOOL_NAMESPACE_SEPARATOR}{upstreamName}. Server keys must not contain ${TOOL_NAMESPACE_SEPARATOR}.`;
}
