import { Client, type ClientOptions } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  type CallToolRequest,
  type CallToolResult,
  CreateMessageRequestSchema,
  ElicitRequestSchema,
  ListRootsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { assertHttpOrHttpsUrl } from "../lib/assert-http-upstream-url.js";
import { sennitJsonLog } from "../lib/sennit-json-log.js";
import { wrapFetchWithDeadline } from "../lib/fetch-timeout.js";
import { oauthClientCredentialsFetch } from "../lib/oauth-client-credentials.js";
import { resolveHeaderTemplates } from "../lib/resolve-env-template.js";
import {
  getActiveHostMcp,
  getCurrentHostMcp,
  runWithHostMcpAsync,
} from "../lib/active-host-mcp.js";
import type { SennitConfig } from "../config/schema.js";
import { applyRootsPolicy, applyUpstreamRootRewrites } from "./roots-policy.js";
import type { UpstreamElicitationBridge } from "./elicitation-bridge.js";
import type { UpstreamRootsBridge } from "./roots-bridge.js";
import type { UpstreamSamplingBridge } from "./sampling-bridge.js";
import type { HostListChangedFanout } from "./host-list-changed-bridge.js";

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
  srv: {
    url: string;
    headers?: Record<string, string>;
    httpRequestTimeoutMs?: number;
    auth?: {
      type: "oauthClientCredentials";
      tokenUrl: string;
      clientId: string;
      clientSecretEnv: string;
      scope?: string;
      audience?: string;
      cacheKey?: string;
      minValidityMs?: number;
    };
  },
  env: Record<string, string>,
): {
  url: URL;
  requestInitAndFetch: {
    requestInit?: { headers: Record<string, string> };
    fetch?: typeof fetch;
  };
} {
  const url = assertHttpOrHttpsUrl(srv.url, `servers.${serverKey}.url`);
  const resolvedHeaders = resolveHeaderTemplates(srv.headers, env);
  const timedFetch =
    srv.httpRequestTimeoutMs !== undefined ? wrapFetchWithDeadline(srv.httpRequestTimeoutMs) : undefined;
  let fetchImpl = timedFetch;
  if (srv.auth?.type === "oauthClientCredentials") {
    fetchImpl = oauthClientCredentialsFetch(
      serverKey,
      srv.auth,
      timedFetch ?? globalThis.fetch,
      resolvedHeaders,
      env,
    );
  }
  return {
    url,
    requestInitAndFetch: {
      ...(resolvedHeaders && Object.keys(resolvedHeaders).length > 0
        ? { requestInit: { headers: resolvedHeaders } }
        : {}),
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    },
  };
}

export type UpstreamHubConnectOptions = {
  signal?: AbortSignal;
};

type ServerEntry = SennitConfig["servers"][string];

type CircuitState = {
  failures: number;
  openUntilMs?: number;
  halfOpenInFlight: number;
};

type UpstreamTelemetry = {
  callsOk: number;
  callsErr: number;
  queueRejected: number;
  circuitRejected: number;
};

type UpstreamListChangedKind = "tools" | "resources" | "prompts";

/** Manages one MCP `Client` per configured upstream (stdio, Streamable HTTP, or legacy SSE). */
export class UpstreamHub {
  private config: SennitConfig | null = null;
  private dynamicToolList = false;
  private dynamicResourceList = false;
  private dynamicPromptList = false;
  private readonly clients = new Map<string, Client>();
  private readonly connectPromises = new Map<string, Promise<Client>>();
  private readonly idleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly queueWaiters = new Map<string, Array<() => void>>();
  private readonly queuedCounts = new Map<string, number>();
  private readonly inFlightCalls = new Map<string, number>();
  private readonly circuitStates = new Map<string, CircuitState>();
  private readonly telemetry = new Map<string, UpstreamTelemetry>();
  private readonly listChangedListeners = new Set<
    (event: { serverKey: string; kind: UpstreamListChangedKind }) => void
  >();
  private readonly activeHostByServer = new Map<string, McpServer>();
  private readonly hostContextTailByServer = new Map<string, Promise<void>>();

  readonly listChangedFanout: HostListChangedFanout;

  constructor(
    listChangedFanout: HostListChangedFanout,
    private readonly rootsBridge?: UpstreamRootsBridge,
    private readonly samplingBridge?: UpstreamSamplingBridge,
    private readonly elicitationBridge?: UpstreamElicitationBridge,
  ) {
    this.listChangedFanout = listChangedFanout;
  }

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
    const fanout = this.listChangedFanout;
    if (this.dynamicToolList || this.dynamicResourceList || this.dynamicPromptList) {
      clientOptions.listChanged = {
        ...(this.dynamicToolList
          ? {
              tools: listChangedNotifyHandler(() => {
                fanout.signalHostToolListChanged();
                this.emitListChanged(serverKey, "tools");
              }),
            }
          : {}),
        ...(this.dynamicResourceList
          ? {
              resources: listChangedNotifyHandler(() => {
                fanout.signalHostResourceListChanged();
                this.emitListChanged(serverKey, "resources");
              }),
            }
          : {}),
        ...(this.dynamicPromptList
          ? {
              prompts: listChangedNotifyHandler(() => {
                fanout.signalHostPromptListChanged();
                this.emitListChanged(serverKey, "prompts");
              }),
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
      const { url, requestInitAndFetch } = urlAndOptsForRemoteMcp(serverKey, srv, baseEnv);
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
      const { url, requestInitAndFetch } = urlAndOptsForRemoteMcp(serverKey, srv, baseEnv);
      const transport = new SSEClientTransport(url, requestInitAndFetch);
      await client.connect(transport);
    } else {
      throw new Error(`unsupported upstream transport for ${JSON.stringify(serverKey)}`);
    }

    throwIfAborted(signal);

    if (this.rootsBridge) {
      const bridge = this.rootsBridge;
      client.setRequestHandler(ListRootsRequestSchema, async () => {
        const hostMcp =
          this.activeHostByServer.get(serverKey) ?? getCurrentHostMcp() ?? getActiveHostMcp();
        if (!hostMcp) {
          bridge.lastHostRootsError =
            "no active host MCP session (roots/list must run within an active host request context)";
          return { roots: [] };
        }
        const hostRoots = await runWithHostMcpAsync(hostMcp, () => bridge.getHostRoots());
        const filtered = applyRootsPolicy(bridge.policy, hostRoots);
        return {
          roots: applyUpstreamRootRewrites(serverKey, bridge.policy, filtered),
        };
      });
    }
    if (this.samplingBridge) {
      const sampling = this.samplingBridge;
      client.setRequestHandler(CreateMessageRequestSchema, async (request) => {
        const hostMcp =
          this.activeHostByServer.get(serverKey) ?? getCurrentHostMcp() ?? getActiveHostMcp();
        if (!hostMcp) {
          throw new Error(
            "No active host MCP session for sampling (sampling/createMessage must run in the invoking host session).",
          );
        }
        return runWithHostMcpAsync(hostMcp, () => sampling.forwardCreateMessage(request.params));
      });
    }
    if (this.elicitationBridge) {
      const elicitation = this.elicitationBridge;
      client.setRequestHandler(ElicitRequestSchema, async (request) => {
        const hostMcp =
          this.activeHostByServer.get(serverKey) ?? getCurrentHostMcp() ?? getActiveHostMcp();
        if (!hostMcp) {
          throw new Error(
            "No active host MCP session for elicitation (elicitation/create must run in the invoking host session).",
          );
        }
        return runWithHostMcpAsync(hostMcp, () => elicitation.forwardElicit(request.params));
      });
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
    this.queueWaiters.clear();
    this.queuedCounts.clear();
    this.inFlightCalls.clear();
    this.circuitStates.clear();
    this.telemetry.clear();
    this.listChangedListeners.clear();
    this.activeHostByServer.clear();
    this.hostContextTailByServer.clear();
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

  circuitState(serverKey: string): { state: "closed" | "open" | "half_open"; openUntilMs?: number } {
    const st = this.circuitStates.get(serverKey);
    if (!st) {
      return { state: "closed" };
    }
    const now = Date.now();
    if (st.openUntilMs !== undefined && st.openUntilMs > now) {
      return { state: "open", openUntilMs: st.openUntilMs };
    }
    if (st.openUntilMs !== undefined && st.openUntilMs <= now) {
      return { state: "half_open" };
    }
    return { state: "closed" };
  }

  telemetrySnapshot(): Record<string, UpstreamTelemetry> {
    return Object.fromEntries(this.configuredServerKeys().map((k) => [k, this.telemetryFor(k)]));
  }

  onListChanged(listener: (event: { serverKey: string; kind: UpstreamListChangedKind }) => void): () => void {
    this.listChangedListeners.add(listener);
    return () => {
      this.listChangedListeners.delete(listener);
    };
  }

  async callTool(
    serverKey: string,
    params: CallToolRequest["params"],
    options?: { signal?: AbortSignal },
  ): Promise<CallToolResult> {
    const client = await this.ensureClient(serverKey);
    if (!client) {
      throw new Error(`unknown serverKey: ${serverKey}`);
    }
    const hostMcp = getCurrentHostMcp() ?? getActiveHostMcp();
    if (!this.requiresHostContextIsolation() || !hostMcp) {
      return this.withToolCallResilience(serverKey, () =>
        client.callTool(params, undefined, { signal: options?.signal }) as Promise<CallToolResult>,
      );
    }
    return this.withBoundHostContext(serverKey, hostMcp, () =>
      this.withToolCallResilience(serverKey, () =>
        client.callTool(params, undefined, { signal: options?.signal }) as Promise<CallToolResult>,
      ),
    );
  }

  private requiresHostContextIsolation(): boolean {
    return this.rootsBridge !== undefined || this.samplingBridge !== undefined || this.elicitationBridge !== undefined;
  }

  private async withBoundHostContext<T>(
    serverKey: string,
    hostMcp: McpServer,
    fn: () => Promise<T>,
  ): Promise<T> {
    const prevTail = this.hostContextTailByServer.get(serverKey) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = prevTail.then(() => gate);
    this.hostContextTailByServer.set(serverKey, tail);
    await prevTail;
    this.activeHostByServer.set(serverKey, hostMcp);
    try {
      return await runWithHostMcpAsync(hostMcp, fn);
    } finally {
      this.activeHostByServer.delete(serverKey);
      release();
      if (this.hostContextTailByServer.get(serverKey) === tail) {
        this.hostContextTailByServer.delete(serverKey);
      }
    }
  }

  private async withToolCallResilience<T>(serverKey: string, fn: () => Promise<T>): Promise<T> {
    const srv = this.config?.servers[serverKey];
    if (!srv) {
      throw new Error(`unknown serverKey: ${serverKey}`);
    }
    await this.acquireConcurrencySlot(serverKey, srv.maxConcurrentCalls, srv.maxQueuedCalls);
    let breakerAcquiredHalfOpen = false;
    try {
      const breaker = srv.circuitBreaker;
      if (breaker) {
        const threshold = breaker.failureThreshold ?? 5;
        const cooldownMs = breaker.cooldownMs ?? 30_000;
        const halfOpenMaxCalls = breaker.halfOpenMaxCalls ?? 1;
        const st = this.circuitStates.get(serverKey) ?? { failures: 0, halfOpenInFlight: 0 };
        const now = Date.now();
        if (st.openUntilMs !== undefined && st.openUntilMs > now) {
          const t = this.telemetryFor(serverKey);
          t.circuitRejected += 1;
          throw new Error(
            `circuit open for ${JSON.stringify(serverKey)} until ${new Date(st.openUntilMs).toISOString()}`,
          );
        }
        if (st.openUntilMs !== undefined && st.openUntilMs <= now) {
          if (st.halfOpenInFlight >= halfOpenMaxCalls) {
            const t = this.telemetryFor(serverKey);
            t.circuitRejected += 1;
            throw new Error(`circuit half-open saturated for ${JSON.stringify(serverKey)}`);
          }
          st.halfOpenInFlight += 1;
          breakerAcquiredHalfOpen = true;
          this.circuitStates.set(serverKey, st);
        } else {
          this.circuitStates.set(serverKey, st);
        }
        try {
          const out = await fn();
          const t = this.telemetryFor(serverKey);
          t.callsOk += 1;
          st.failures = 0;
          st.openUntilMs = undefined;
          if (breakerAcquiredHalfOpen && st.halfOpenInFlight > 0) {
            st.halfOpenInFlight -= 1;
          }
          this.circuitStates.set(serverKey, st);
          return out;
        } catch (e) {
          const t = this.telemetryFor(serverKey);
          t.callsErr += 1;
          st.failures += 1;
          if (st.failures >= threshold) {
            st.openUntilMs = Date.now() + cooldownMs;
            st.failures = 0;
          }
          if (breakerAcquiredHalfOpen && st.halfOpenInFlight > 0) {
            st.halfOpenInFlight -= 1;
          }
          this.circuitStates.set(serverKey, st);
          throw e;
        }
      }
      const out = await fn();
      const t = this.telemetryFor(serverKey);
      t.callsOk += 1;
      return out;
    } finally {
      this.releaseConcurrencySlot(serverKey);
    }
  }

  private async acquireConcurrencySlot(
    serverKey: string,
    maxConcurrentCalls: number | undefined,
    maxQueuedCalls: number | undefined,
  ): Promise<void> {
    if (maxConcurrentCalls === undefined) {
      return;
    }
    for (;;) {
      const inFlight = this.inFlightCalls.get(serverKey) ?? 0;
      if (inFlight < maxConcurrentCalls) {
        this.inFlightCalls.set(serverKey, inFlight + 1);
        return;
      }
      const queued = this.queuedCounts.get(serverKey) ?? 0;
      if (maxQueuedCalls !== undefined && queued >= maxQueuedCalls) {
        const t = this.telemetryFor(serverKey);
        t.queueRejected += 1;
        throw new Error(`upstream queue full for ${JSON.stringify(serverKey)}`);
      }
      await new Promise<void>((resolve) => {
        const waiters = this.queueWaiters.get(serverKey) ?? [];
        this.queueWaiters.set(serverKey, waiters);
        waiters.push(resolve);
        this.queuedCounts.set(serverKey, queued + 1);
      });
      const nextQueued = Math.max(0, (this.queuedCounts.get(serverKey) ?? 1) - 1);
      this.queuedCounts.set(serverKey, nextQueued);
    }
  }

  private releaseConcurrencySlot(serverKey: string): void {
    const curr = this.inFlightCalls.get(serverKey) ?? 0;
    if (curr > 0) {
      this.inFlightCalls.set(serverKey, curr - 1);
    }
    const waiters = this.queueWaiters.get(serverKey);
    const next = waiters?.shift();
    if (next) {
      next();
    }
  }

  private telemetryFor(serverKey: string): UpstreamTelemetry {
    const existing = this.telemetry.get(serverKey);
    if (existing) {
      return existing;
    }
    const created: UpstreamTelemetry = {
      callsOk: 0,
      callsErr: 0,
      queueRejected: 0,
      circuitRejected: 0,
    };
    this.telemetry.set(serverKey, created);
    return created;
  }

  private emitListChanged(serverKey: string, kind: UpstreamListChangedKind): void {
    for (const listener of this.listChangedListeners) {
      try {
        listener({ serverKey, kind });
      } catch {
        // ignore listener failures
      }
    }
  }
}
