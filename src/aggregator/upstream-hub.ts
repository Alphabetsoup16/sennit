import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import type { SennitConfig } from "../config/schema.js";

/** Manages one MCP `Client` per configured upstream (stdio). */
export class UpstreamHub {
  private readonly clients = new Map<string, Client>();

  async connect(config: SennitConfig): Promise<void> {
    for (const [key, srv] of Object.entries(config.servers)) {
      const baseEnv = getDefaultEnvironment();
      const transport = new StdioClientTransport({
        command: srv.command,
        args: srv.args ?? [],
        env: srv.env ? { ...baseEnv, ...srv.env } : baseEnv,
        cwd: srv.cwd,
        stderr: "inherit",
      });
      const client = new Client(
        { name: `sennit-upstream-${key}`, version: "0.1.0" },
        { capabilities: {} },
      );
      await client.connect(transport);
      this.clients.set(key, client);
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
