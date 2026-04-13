import { Client, type ClientOptions } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CreateMessageRequestSchema,
  ElicitRequestSchema,
  ListRootsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { assertHttpOrHttpsUrl } from "../lib/assert-http-upstream-url.js";
import { sennitJsonLog } from "../lib/sennit-json-log.js";
import { wrapFetchWithDeadline } from "../lib/fetch-timeout.js";
import type { SennitConfig } from "../config/schema.js";
import { applyRootsPolicy, applyUpstreamRootRewrites } from "./roots-policy.js";
import type { UpstreamElicitationBridge } from "./elicitation-bridge.js";
import type { UpstreamRootsBridge } from "./roots-bridge.js";
import type { UpstreamSamplingBridge } from "./sampling-bridge.js";
import type { UpstreamHostListChangedBridge } from "./host-list-changed-bridge.js";

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("connect aborted", "AbortError");
  }
}

function listChangedNotifyHandler(notify: () => void) {
  return {
    autoRefresh: false as const,
    debounceMs: 0,
    onChanged: (error: Error | null | undefined) => {
      if (error) {
        return;
      }
      notify();
    },
  };
}

/** Shared URL validation, optional headers, and deadline-wrapped `fetch` for HTTP-based MCP transports. */
function urlAndOptsForRemoteMcp(
  serverKey: string,
  srv: { url: string; headers?: Record<string, string>; httpRequestTimeoutMs?: number },
): {
  url: URL;
  requestInitAndFetch: {
    requestInit?: { headers: Record<string, string> };
    fetch?: typeof fetch;
  };
} {
  const url = assertHttpOrHttpsUrl(srv.url, `servers.${serverKey}.url`);
  const fetchImpl =
    srv.httpRequestTimeoutMs !== undefined
      ? wrapFetchWithDeadline(srv.httpRequestTimeoutMs)
      : undefined;
  return {
    url,
    requestInitAndFetch: {
      ...(srv.headers && Object.keys(srv.headers).length > 0
        ? { requestInit: { headers: srv.headers } }
        : {}),
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    },
  };
}

export type UpstreamHubConnectOptions = {
  signal?: AbortSignal;
};

type ServerEntry = SennitConfig["servers"][string];

/** Manages one MCP `Client` per configured upstream (stdio, Streamable HTTP, or legacy SSE). */
export class UpstreamHub {
  private config: SennitConfig | null = null;
  private dynamicToolList = false;
  private dynamicResourceList = false;
  private dynamicPromptList = false;
  private readonly clients = new Map<string, Client>();
  private readonly connectPromises = new Map<string, Promise<Client>>();
  private readonly idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly rootsBridge?: UpstreamRootsBridge,
    private readonly samplingBridge?: UpstreamSamplingBridge,
    private readonly elicitationBridge?: UpstreamElicitationBridge,
    private readonly hostListChangedBridge?: UpstreamHostListChangedBridge,
  ) {}

  /** Configured upstream keys (stable for `sennit.meta` after `connect`). */
  configuredServerKeys(): string[] {
    return this.config ? Object.keys(this.config.servers) : [];
  }

  /**
   * Eager-connect upstreams that are not `lazy`. Lazy servers connect on {@link ensureClient}.
   */
  async connect(config: SennitConfig, options?: UpstreamHubConnectOptions): Promise<void> {
    const signal = options?.signal;
    this.config = config;
    this.dynamicToolList = config.dynamicToolList === true;
    this.dynamicResourceList = config.dynamicResourceList === true;
    this.dynamicPromptList = config.dynamicPromptList === true;
    try {
      const baseEnv = getDefaultEnvironment();
      for (const [key, srv] of Object.entries(config.servers)) {
        throwIfAborted(signal);
        if (srv.lazy) {
          continue;
        }
        const client = await this.spawnClient(key, srv, baseEnv, signal);
        this.clients.set(key, client);
      }
    } catch (e) {
      await this.close().catch(() => undefined);
      throw e;
    }
  }

  /**
   * Return a live client, connecting if needed (lazy servers, or after idle disconnect).
   */
  async ensureClient(serverKey: string): Promise<Client | undefined> {
    const srv = this.config?.servers[serverKey];
    if (!srv) {
      return undefined;
    }

    const connected = this.clients.get(serverKey);
    if (connected) {
      return connected;
    }

    const pending = this.connectPromises.get(serverKey);
    if (pending) {
      return pending;
    }

    const baseEnv = getDefaultEnvironment();
    const promise = this.spawnClient(serverKey, srv, baseEnv, undefined)
      .then((client) => {
        this.clients.set(serverKey, client);
        return client;
      })
      .finally(() => {
        this.connectPromises.delete(serverKey);
      });

    this.connectPromises.set(serverKey, promise);
    return promise;
  }

  /**
   * Reschedule idle disconnect for this upstream after a successful proxied operation.
   */
  touchActivity(serverKey: string): void {
    const srv = this.config?.servers[serverKey];
    const ms = srv?.idleTimeoutMs;
    if (ms === undefined) {
      return;
    }

    const prev = this.idleTimers.get(serverKey);
    if (prev !== undefined) {
      clearTimeout(prev);
    }

    const timer = setTimeout(() => {
      void this.idleDisconnect(serverKey);
    }, ms);
    this.idleTimers.set(serverKey, timer);
  }

  private async idleDisconnect(serverKey: string): Promise<void> {
    this.idleTimers.delete(serverKey);
    const c = this.clients.get(serverKey);
    if (!c) {
      return;
    }
    this.clients.delete(serverKey);
    sennitJsonLog("upstream_idle_disconnect", { serverKey });
    await c.close().catch(() => undefined);
  }

  private async spawnClient(
    serverKey: string,
    srv: ServerEntry,
    baseEnv: Record<string, string>,
    signal: AbortSignal | undefined,
  ): Promise<Client> {
    const clientCapabilities: {
      roots?: Record<string, unknown>;
      sampling?: { tools?: Record<string, unknown> };
      elicitation?: { form?: Record<string, unknown>; url?: Record<string, unknown> };
    } = {};
    if (this.rootsBridge) {
      clientCapabilities.roots = {};
    }
    if (this.samplingBridge) {
      clientCapabilities.sampling = { tools: {} };
    }
    if (this.elicitationBridge) {
      clientCapabilities.elicitation = { form: {}, url: {} };
    }

    const clientOptions: ClientOptions = { capabilities: clientCapabilities };
    const bridge = this.hostListChangedBridge;
    if (
      bridge &&
      (this.dynamicToolList || this.dynamicResourceList || this.dynamicPromptList)
    ) {
      clientOptions.listChanged = {
        ...(this.dynamicToolList
          ? { tools: listChangedNotifyHandler(() => bridge.signalHostToolListChanged()) }
          : {}),
        ...(this.dynamicResourceList
          ? {
              resources: listChangedNotifyHandler(() =>
                bridge.signalHostResourceListChanged(),
              ),
            }
          : {}),
        ...(this.dynamicPromptList
          ? {
              prompts: listChangedNotifyHandler(() => bridge.signalHostPromptListChanged()),
            }
          : {}),
      };
    }

    const client = new Client(
      { name: `sennit-upstream-${serverKey}`, version: "0.1.0" },
      clientOptions,
    );

    if (srv.transport === "stdio") {
      const transport = new StdioClientTransport({
        command: srv.command,
        args: srv.args ?? [],
        env: srv.env ? { ...baseEnv, ...srv.env } : baseEnv,
        cwd: srv.cwd,
        stderr: "inherit",
      });
      await client.connect(transport);
    } else if (srv.transport === "streamableHttp") {
      const { url, requestInitAndFetch } = urlAndOptsForRemoteMcp(serverKey, srv);
      const reconnectionOptions =
        srv.streamableHttpReconnection !== undefined
          ? {
              maxRetries: srv.streamableHttpReconnection.maxRetries ?? 2,
              initialReconnectionDelay:
                srv.streamableHttpReconnection.initialReconnectionDelay ?? 1000,
              maxReconnectionDelay:
                srv.streamableHttpReconnection.maxReconnectionDelay ?? 30_000,
              reconnectionDelayGrowFactor:
                srv.streamableHttpReconnection.reconnectionDelayGrowFactor ?? 1.5,
            }
          : undefined;
      const transport = new StreamableHTTPClientTransport(url, {
        ...requestInitAndFetch,
        ...(reconnectionOptions ? { reconnectionOptions } : {}),
      });
      await client.connect(transport);
    } else if (srv.transport === "sse") {
      const { url, requestInitAndFetch } = urlAndOptsForRemoteMcp(serverKey, srv);
      const transport = new SSEClientTransport(url, requestInitAndFetch);
      await client.connect(transport);
    } else {
      throw new Error(`unsupported upstream transport for ${JSON.stringify(serverKey)}`);
    }

    throwIfAborted(signal);

    if (this.rootsBridge) {
      const bridge = this.rootsBridge;
      client.setRequestHandler(ListRootsRequestSchema, async () => {
        const hostRoots = await bridge.getHostRoots();
        const filtered = applyRootsPolicy(bridge.policy, hostRoots);
        return {
          roots: applyUpstreamRootRewrites(serverKey, bridge.policy, filtered),
        };
      });
    }
    if (this.samplingBridge) {
      const sampling = this.samplingBridge;
      client.setRequestHandler(CreateMessageRequestSchema, async (request) =>
        sampling.forwardCreateMessage(request.params),
      );
    }
    if (this.elicitationBridge) {
      const elicitation = this.elicitationBridge;
      client.setRequestHandler(ElicitRequestSchema, async (request) =>
        elicitation.forwardElicit(request.params),
      );
    }

    return client;
  }

  /** @deprecated Prefer {@link ensureClient} when the hub may idle-disconnect or use lazy upstreams. */
  get(serverKey: string): Client | undefined {
    return this.clients.get(serverKey);
  }

  /** Same as {@link configuredServerKeys} after `connect`. */
  serverKeys(): string[] {
    return this.configuredServerKeys();
  }

  /** Connected clients only (may omit lazy idle peers). */
  entries(): [string, Client][] {
    return [...this.clients.entries()];
  }

  async close(): Promise<void> {
    for (const t of this.idleTimers.values()) {
      clearTimeout(t);
    }
    this.idleTimers.clear();
    this.connectPromises.clear();
    this.config = null;
    this.dynamicToolList = false;
    this.dynamicResourceList = false;
    this.dynamicPromptList = false;
    await Promise.all(
      [...this.clients.values()].map((c) =>
        c.close().catch(() => undefined),
      ),
    );
    this.clients.clear();
  }
}
