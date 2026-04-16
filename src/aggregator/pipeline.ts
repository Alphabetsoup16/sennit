import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SennitConfig } from "../config/schema.js";
import { errorMessage } from "../lib/error-message.js";
import { jsonText } from "../lib/json-text.js";
import { BATCH_CALL_MAX_ITEMS } from "../lib/limits.js";
import { VERSION } from "../lib/version.js";
import { executeBatchCall } from "./batch.js";
import type { DoctorInspectResult } from "./doctor-inspect-types.js";
import {
  doctorInspectResultFromProbeRows,
  probeConnectedHub,
  promptCatalogsFromProbeRowsOrThrow,
  toolCatalogsFromProbeRowsOrThrow,
  type UpstreamProbeRow,
} from "./upstream-probe.js";
import { looseToolArgumentsSchema } from "./proxy-input-schema.js";
import {
  proxiedNamespacingRuleSummary,
  type RemovableRegistration,
  registerProxiedPrompts,
  registerProxiedTools,
} from "./register-proxied-surface.js";
import { registerProxyResources, resourceNamespacingSummary } from "./register-resources.js";
import { registerAliasTools } from "./register-alias-tools.js";
import type { UpstreamRootsBridge } from "./roots-bridge.js";
import { makeUpstreamRootsBridge } from "./roots-bridge.js";
import { makeUpstreamElicitationBridge } from "./elicitation-bridge.js";
import { makeUpstreamSamplingBridge } from "./sampling-bridge.js";
import {
  attachHostListChangedSubscriptions,
  HostListChangedFanout,
} from "./host-list-changed-bridge.js";
import { UpstreamHub } from "./upstream-hub.js";
import { runWithHostMcpAsync } from "../lib/active-host-mcp.js";

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
type ListedPrompt = Awaited<ReturnType<Client["listPrompts"]>>["prompts"][number];

export type AggregatorHandle = {
  mcp: McpServer;
  close: () => Promise<void>;
  detachHostListChanged?: () => void;
  detachDynamicCatalogRefresh?: () => void;
};

export type AggregatorSurfaceState = {
  removable: RemovableRegistration[];
};

export function createMcpAndHub(config: SennitConfig): {
  mcp: McpServer;
  hub: UpstreamHub;
  rootsBridge: UpstreamRootsBridge | undefined;
} {
  const mcp = new McpServer(
    { name: "sennit", version: VERSION },
    { capabilities: { tools: {}, prompts: {} } },
  );
  const rootsBridge = makeUpstreamRootsBridge(config);
  const samplingBridge = makeUpstreamSamplingBridge();
  const elicitationBridge = makeUpstreamElicitationBridge();
  const listChangedFanout = new HostListChangedFanout();
  const hub = new UpstreamHub(listChangedFanout, rootsBridge, samplingBridge, elicitationBridge);
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
  upstreamPromptCatalogs: Array<{ serverKey: string; prompts: ListedPrompt[] }>,
  rootsBridge: UpstreamRootsBridge | undefined,
): Promise<AggregatorSurfaceState> {
  mcp.registerTool(
    "sennit.meta",
    {
      description:
        "Sennit metadata: version, configured upstream keys, tool naming rules, and roots policy.",
    },
    async () =>
      runWithHostMcpAsync(mcp, async () => ({
        content: [
          {
            type: "text",
            text: jsonText({
              schemaVersion: 1,
              sennitVersion: VERSION,
              upstreamServerKeys: hub.serverKeys(),
              upstreamRuntime: Object.fromEntries(
                hub
                  .serverKeys()
                  .map((k) => [k, { circuit: hub.circuitState(k), telemetry: hub.telemetrySnapshot()[k] }]),
              ),
              roots: config.roots,
              namespacing: proxiedNamespacingRuleSummary(),
              sampling:
                "Upstream servers may call sampling/createMessage during proxied work; Sennit forwards to the host client when it declares the sampling capability (including sampling.tools for tool loops).",
              toolsListDescriptionMaxChars: config.toolsListDescriptionMaxChars ?? null,
              dynamicToolList: config.dynamicToolList ?? false,
              dynamicResourceList: config.dynamicResourceList ?? false,
              dynamicPromptList: config.dynamicPromptList ?? false,
              batchCallMaxConcurrency: config.batchCallMaxConcurrency ?? null,
              lazyAndIdle:
                "servers.*.lazy skips spawn at connect until probe or a proxied call; servers.*.idleTimeoutMs closes the upstream client after idle (next call reconnects; merged catalog unchanged until host reconnects to Sennit).",
              elicitation:
                "Upstream servers may call elicitation/create during proxied work; Sennit forwards to the host client when it declares elicitation (form and/or url).",
              resources: resourceNamespacingSummary(),
              ...(config.roots.mode !== "ignore"
                ? {
                    hostRootsListError: rootsBridge?.lastHostRootsError ?? null,
                  }
                : {}),
            }),
          },
        ],
      })),
  );

  mcp.registerTool(
    "sennit.batch_call",
    {
      description: `Run many upstream MCP tool calls in parallel (at most ${BATCH_CALL_MAX_ITEMS} calls per request). Use raw upstream toolName per serverKey (not the namespaced id).`,
      inputSchema: batchInputSchema,
    },
    async (args) =>
      runWithHostMcpAsync(mcp, async () => {
        const { calls } = batchInputSchema.parse(args);
        const results = await executeBatchCall(hub, calls, {
          maxConcurrency: config.batchCallMaxConcurrency,
          toolCallTimeoutMsForServer: (sk) => config.servers[sk]?.toolCallTimeoutMs,
        });
        return {
          content: [{ type: "text", text: jsonText(results) }],
        };
      }),
  );

  const removable: RemovableRegistration[] = [];
  removable.push(...(await registerProxiedTools(mcp, hub, config, upstreamToolCatalogs)));
  removable.push(...registerAliasTools(mcp, hub, config));
  removable.push(...(await registerProxiedPrompts(mcp, hub, config, upstreamPromptCatalogs)));
  removable.push(...(await registerProxyResources(mcp, hub, config)));
  return { removable };
}

export function attachDynamicCatalogRefresh(
  mcp: McpServer,
  hub: UpstreamHub,
  config: SennitConfig,
  rootsBridge: UpstreamRootsBridge | undefined,
  state: AggregatorSurfaceState,
): () => void {
  if (!(config.dynamicToolList || config.dynamicResourceList || config.dynamicPromptList)) {
    return () => undefined;
  }
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let refreshing = false;
  let refreshAgain = false;

  const removeAll = () => {
    for (const h of state.removable) {
      try {
        h.remove();
      } catch {
        // ignore stale handles
      }
    }
    state.removable = [];
  };

  const rebuild = async () => {
    if (closed) {
      return;
    }
    if (refreshing) {
      refreshAgain = true;
      return;
    }
    refreshing = true;
    try {
      const rows = await probeConnectedHub(hub);
      const toolCatalogs = toolCatalogsFromProbeRowsOrThrow(rows);
      const promptCatalogs = promptCatalogsFromProbeRowsOrThrow(rows);
      removeAll();
      state.removable.push(...(await registerProxiedTools(mcp, hub, config, toolCatalogs)));
      state.removable.push(...registerAliasTools(mcp, hub, config));
      state.removable.push(...(await registerProxiedPrompts(mcp, hub, config, promptCatalogs)));
      state.removable.push(...(await registerProxyResources(mcp, hub, config)));
      if (config.dynamicToolList) {
        try {
          mcp.sendToolListChanged();
        } catch {
          // host may be disconnected
        }
      }
      if (config.dynamicResourceList) {
        try {
          mcp.sendResourceListChanged();
        } catch {
          // host may be disconnected
        }
      }
      if (config.dynamicPromptList) {
        try {
          mcp.sendPromptListChanged();
        } catch {
          // host may be disconnected
        }
      }
      if (config.roots.mode !== "ignore") {
        rootsBridge?.getHostRoots().catch(() => undefined);
      }
    } catch {
      // keep existing registrations if rebuild fails
    } finally {
      refreshing = false;
      if (refreshAgain && !closed) {
        refreshAgain = false;
        void rebuild();
      }
    }
  };

  const unsubscribe = hub.onListChanged(() => {
    if (closed) {
      return;
    }
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      void rebuild();
    }, 50);
  });

  return () => {
    closed = true;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    unsubscribe();
    removeAll();
  };
}

export function finalizeAggregatorHandle(
  mcp: McpServer,
  hub: UpstreamHub,
  detachHostListChanged?: () => void,
  detachDynamicCatalogRefresh?: () => void,
): AggregatorHandle {
  return {
    mcp,
    detachHostListChanged,
    detachDynamicCatalogRefresh,
    close: async () => {
      detachDynamicCatalogRefresh?.();
      detachHostListChanged?.();
      await mcp.close();
      await hub.close();
    },
  };
}

/**
 * Connect, probe upstreams, register surface. Used by `serve` and as a fallback when plan’s timed
 * connect phase fails.
 */
/** Shared upstream connect + probe; used by stdio {@link createAggregator} and HTTP gateway. */
export async function connectAggregatedHub(config: SennitConfig): Promise<{
  hub: UpstreamHub;
  rootsBridge: UpstreamRootsBridge | undefined;
  toolCatalogs: Array<{ serverKey: string; tools: ListedTool[] }>;
  promptCatalogs: Array<{ serverKey: string; prompts: ListedPrompt[] }>;
  inspect: DoctorInspectResult;
}> {
  const rootsBridge = makeUpstreamRootsBridge(config);
  const samplingBridge = makeUpstreamSamplingBridge();
  const elicitationBridge = makeUpstreamElicitationBridge();
  const listChangedFanout = new HostListChangedFanout();
  const hub = new UpstreamHub(listChangedFanout, rootsBridge, samplingBridge, elicitationBridge);
  await hub.connect(config);
  const rows = await probeConnectedHub(hub);
  return {
    hub,
    rootsBridge,
    toolCatalogs: toolCatalogsFromProbeRowsOrThrow(rows),
    promptCatalogs: promptCatalogsFromProbeRowsOrThrow(rows),
    inspect: doctorInspectResultFromProbeRows(rows),
  };
}

export async function createAggregator(config: SennitConfig): Promise<AggregatorHandle> {
  const { hub, rootsBridge, toolCatalogs, promptCatalogs } = await connectAggregatedHub(config);
  const mcp = new McpServer(
    { name: "sennit", version: VERSION },
    { capabilities: { tools: {}, prompts: {} } },
  );
  try {
    const state = await registerAggregatorSurface(
      mcp,
      hub,
      config,
      toolCatalogs,
      promptCatalogs,
      rootsBridge,
    );
    const detachDynamicCatalogRefresh = attachDynamicCatalogRefresh(
      mcp,
      hub,
      config,
      rootsBridge,
      state,
    );
    const detachHostListChanged = attachHostListChangedSubscriptions(
      mcp,
      hub.listChangedFanout,
      config,
    );
    return finalizeAggregatorHandle(mcp, hub, detachHostListChanged, detachDynamicCatalogRefresh);
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

export { attachHostListChangedSubscriptions, HostListChangedFanout } from "./host-list-changed-bridge.js";
