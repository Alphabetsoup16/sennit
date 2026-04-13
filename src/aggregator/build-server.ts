import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { jsonText } from "../lib/json-text.js";
import { namespacedToolName, TOOL_NAMESPACE_SEPARATOR } from "../lib/namespace.js";
import { VERSION } from "../lib/version.js";
import type { SennitConfig } from "../config/schema.js";
import { executeBatchCall } from "./batch.js";
import { looseToolArgumentsSchema, proxyToolInputSchema } from "./proxy-input-schema.js";
import { makeUpstreamRootsBridge } from "./roots-bridge.js";
import { UpstreamHub } from "./upstream-hub.js";

const batchInputSchema = z.object({
  calls: z.array(
    z.object({
      serverKey: z.string(),
      toolName: z.string(),
      arguments: looseToolArgumentsSchema.optional(),
      clientCallId: z.string(),
    }),
  ),
});

export type AggregatorHandle = {
  mcp: McpServer;
  close: () => Promise<void>;
};

/**
 * Connects to all configured stdio upstreams, registers `sennit.*` meta tools and
 * namespaced proxies for each upstream tool.
 */
export async function createAggregator(config: SennitConfig): Promise<AggregatorHandle> {
  const mcp = new McpServer(
    { name: "sennit", version: VERSION },
    { capabilities: { tools: {} } },
  );

  const hub = new UpstreamHub(makeUpstreamRootsBridge(config, mcp));

  try {
    await hub.connect(config);

    mcp.registerTool(
      "sennit.meta",
      {
        description:
          "Sennit metadata: version, configured upstream keys, tool naming rules, and roots policy.",
      },
      async () => ({
        content: [
          {
            type: "text",
            text: jsonText({
              schemaVersion: 1,
              sennitVersion: VERSION,
              upstreamServerKeys: hub.serverKeys(),
              roots: config.roots,
              namespacing: `Proxied tools are {serverKey}${TOOL_NAMESPACE_SEPARATOR}{upstreamToolName}. Server keys must not contain ${TOOL_NAMESPACE_SEPARATOR}.`,
            }),
          },
        ],
      }),
    );

    mcp.registerTool(
      "sennit.batch_call",
      {
        description:
          "Run many upstream MCP tool calls in parallel. Use raw upstream toolName per serverKey (not the namespaced id).",
        inputSchema: batchInputSchema,
      },
      async (args) => {
        const { calls } = batchInputSchema.parse(args);
        const results = await executeBatchCall(hub, calls);
        return {
          content: [{ type: "text", text: jsonText(results) }],
        };
      },
    );

    const seen = new Set<string>();
    const upstreamToolLists = await Promise.all(
      hub.entries().map(async ([serverKey, client]) => {
        const { tools } = await client.listTools();
        return { serverKey, tools };
      }),
    );

    for (const { serverKey, tools } of upstreamToolLists) {
      const allow = config.servers[serverKey]?.tools;

      for (const tool of tools) {
        if (allow && !allow.includes(tool.name)) {
          continue;
        }

        const full = namespacedToolName(serverKey, tool.name);
        if (seen.has(full)) {
          throw new Error(`duplicate namespaced tool after merge: ${full}`);
        }
        seen.add(full);

        mcp.registerTool(
          full,
          {
            description:
              tool.description ??
              `Proxied from upstream "${serverKey}" (tool: ${tool.name}).`,
            inputSchema: proxyToolInputSchema(tool.inputSchema),
          },
          async (args) => {
            const c = hub.get(serverKey);
            if (!c) {
              return {
                content: [{ type: "text", text: `upstream missing: ${serverKey}` }],
                isError: true,
              };
            }
            const out = await c.callTool({
              name: tool.name,
              arguments: (args as Record<string, unknown>) ?? {},
            });
            return out as CallToolResult;
          },
        );
      }
    }

    return {
      mcp,
      close: async () => {
        await mcp.close();
        await hub.close();
      },
    };
  } catch (e) {
    await hub.close().catch(() => undefined);
    await mcp.close().catch(() => undefined);
    throw e;
  }
}
