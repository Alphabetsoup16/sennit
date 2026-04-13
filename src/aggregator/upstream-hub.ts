import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { SennitConfig } from "../config/schema.js";
import { applyRootsPolicy } from "./roots-policy.js";
import type { UpstreamRootsBridge } from "./roots-bridge.js";

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("connect aborted", "AbortError");
  }
}

export type UpstreamHubConnectOptions = {
  signal?: AbortSignal;
};

/** Manages one MCP `Client` per configured upstream (stdio). */
export class UpstreamHub {
  private readonly clients = new Map<string, Client>();

  constructor(private readonly rootsBridge?: UpstreamRootsBridge) {}

  async connect(config: SennitConfig, options?: UpstreamHubConnectOptions): Promise<void> {
    const signal = options?.signal;
    try {
      const baseEnv = getDefaultEnvironment();
      for (const [key, srv] of Object.entries(config.servers)) {
        throwIfAborted(signal);
        const transport = new StdioClientTransport({
          command: srv.command,
          args: srv.args ?? [],
          env: srv.env ? { ...baseEnv, ...srv.env } : baseEnv,
          cwd: srv.cwd,
          stderr: "inherit",
        });
        const client = new Client(
          { name: `sennit-upstream-${key}`, version: "0.1.0" },
          {
            capabilities: this.rootsBridge ? { roots: {} } : {},
          },
        );
        await client.connect(transport);
        throwIfAborted(signal);
        if (this.rootsBridge) {
          const bridge = this.rootsBridge;
          client.setRequestHandler(ListRootsRequestSchema, async () => ({
            roots: applyRootsPolicy(bridge.policy, await bridge.getHostRoots()),
          }));
        }
        this.clients.set(key, client);
      }
    } catch (e) {
      await this.close().catch(() => undefined);
      throw e;
    }
  }

  get(serverKey: string): Client | undefined {
    return this.clients.get(serverKey);
  }

  serverKeys(): string[] {
    return [...this.clients.keys()];
  }

  entries(): [string, Client][] {
    return [...this.clients.entries()];
  }

  async close(): Promise<void> {
    await Promise.all(
      [...this.clients.values()].map((c) =>
        c.close().catch(() => undefined),
      ),
    );
    this.clients.clear();
  }
}
