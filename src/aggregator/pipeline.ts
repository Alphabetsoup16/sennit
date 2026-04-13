import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { SennitConfig } from "../config/schema.js";
import { errorMessage } from "../lib/error-message.js";
import { jsonText } from "../lib/json-text.js";
import { BATCH_CALL_MAX_ITEMS } from "../lib/limits.js";
import { takeUniqueMergedToolId, TOOL_NAMESPACE_SEPARATOR } from "../lib/namespace.js";
import { VERSION } from "../lib/version.js";
import { executeBatchCall } from "./batch.js";
import type { DoctorInspectResult } from "./doctor-inspect-types.js";
import {
  doctorInspectResultFromProbeRows,
  probeConnectedHub,
  toolCatalogsFromProbeRowsOrThrow,
  type UpstreamProbeRow,
} from "./upstream-probe.js";
import { looseToolArgumentsSchema, proxyToolInputSchema } from "./proxy-input-schema.js";
import { registerProxyResources, resourceNamespacingSummary } from "./register-resources.js";
import type { UpstreamRootsBridge } from "./roots-bridge.js";
import { makeUpstreamRootsBridge } from "./roots-bridge.js";
import { makeUpstreamSamplingBridge } from "./sampling-bridge.js";
import { UpstreamHub } from "./upstream-hub.js";

const batchInputSchema = z.object({
  calls: z
    .array(
      z.object({
        serverKey: z.string(),
        toolName: z.string(),
        arguments: looseToolArgumentsSchema.optional(),
        clientCallId: z.string(),
      }),
    )
    .max(BATCH_CALL_MAX_ITEMS, {
      error: () => `at most ${BATCH_CALL_MAX_ITEMS} calls per batch`,
    }),
});

type ListedTool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];

export type AggregatorHandle = {
  mcp: McpServer;
  close: () => Promise<void>;
};

export function createMcpAndHub(config: SennitConfig): {
  mcp: McpServer;
  hub: UpstreamHub;
  rootsBridge: UpstreamRootsBridge | undefined;
} {
  const mcp = new McpServer(
    { name: "sennit", version: VERSION },
    { capabilities: { tools: {} } },
  );
  const rootsBridge = makeUpstreamRootsBridge(config, mcp);
  const samplingBridge = makeUpstreamSamplingBridge(mcp);
  const hub = new UpstreamHub(rootsBridge, samplingBridge);
  return { mcp, hub, rootsBridge };
}

/**
 * Register host-facing tools and resources after the hub is connected and catalogs are known.
 */
export async function registerAggregatorSurface(
  mcp: McpServer,
  hub: UpstreamHub,
  config: SennitConfig,
  upstreamToolCatalogs: Array<{ serverKey: string; tools: ListedTool[] }>,
  rootsBridge: UpstreamRootsBridge | undefined,
): Promise<void> {
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
            sampling:
              "Upstream servers may call sampling/createMessage during proxied work; Sennit forwards to the host client when it declares the sampling capability (including sampling.tools for tool loops).",
            resources: resourceNamespacingSummary(),
            ...(config.roots.mode !== "ignore"
              ? {
                  hostRootsListError: rootsBridge?.lastHostRootsError ?? null,
                }
              : {}),
          }),
        },
      ],
    }),
  );

  mcp.registerTool(
    "sennit.batch_call",
    {
      description: `Run many upstream MCP tool calls in parallel (at most ${BATCH_CALL_MAX_ITEMS} calls per request). Use raw upstream toolName per serverKey (not the namespaced id).`,
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
  for (const { serverKey, tools } of upstreamToolCatalogs) {
    const allow = config.servers[serverKey]?.tools;

    for (const tool of tools) {
      if (allow && !allow.includes(tool.name)) {
        continue;
      }

      const full = takeUniqueMergedToolId(seen, serverKey, tool.name);

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

  await registerProxyResources(mcp, hub, config);
}

export function finalizeAggregatorHandle(mcp: McpServer, hub: UpstreamHub): AggregatorHandle {
  return {
    mcp,
    close: async () => {
      await mcp.close();
      await hub.close();
    },
  };
}

/**
 * Connect, probe upstreams, register surface. Used by `serve` and as a fallback when plan’s timed
 * connect phase fails.
 */
export async function createAggregator(config: SennitConfig): Promise<AggregatorHandle> {
  const { mcp, hub, rootsBridge } = createMcpAndHub(config);

  try {
    await hub.connect(config);
    const rows = await probeConnectedHub(hub);
    const catalogs = toolCatalogsFromProbeRowsOrThrow(rows);
    await registerAggregatorSurface(mcp, hub, config, catalogs, rootsBridge);
    return finalizeAggregatorHandle(mcp, hub);
  } catch (e) {
    await hub.close().catch(() => undefined);
    await mcp.close().catch(() => undefined);
    throw e;
  }
}

export type PlanConnectProbeOutcome =
  | {
      fatal: true;
      inspect: DoctorInspectResult;
    }
  | {
      fatal: false;
      inspect: DoctorInspectResult;
      mcp: McpServer;
      hub: UpstreamHub;
      rootsBridge: UpstreamRootsBridge | undefined;
      rows: UpstreamProbeRow[];
    };

/**
 * Wall-clock budget applies to connect + upstream probe only (same as `doctor inspect` / former `runPlan` inspect phase).
 */
export async function connectAndProbeWithTimeout(
  config: SennitConfig,
  timeoutMs: number,
): Promise<PlanConnectProbeOutcome> {
  const { mcp, hub, rootsBridge } = createMcpAndHub(config);
  const ac = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const work = async (): Promise<UpstreamProbeRow[]> => {
    await hub.connect(config, { signal: ac.signal });
    return probeConnectedHub(hub);
  };

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      ac.abort();
      reject(new Error(`inspect timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const rows = await Promise.race([work(), timeoutPromise]);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    return {
      fatal: false,
      inspect: doctorInspectResultFromProbeRows(rows),
      mcp,
      hub,
      rootsBridge,
      rows,
    };
  } catch (e) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    const fatalError = errorMessage(e);
    await hub.close().catch(() => undefined);
    await mcp.close().catch(() => undefined);
    return {
      fatal: true,
      inspect: {
        schemaVersion: 1,
        ok: false,
        fatalError,
        upstreams: [],
      },
    };
  }
}
