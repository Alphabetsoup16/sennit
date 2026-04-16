import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  attachHostListChangedSubscriptions,
  connectAggregatedHub,
  registerAggregatorSurface,
} from "../aggregator/build-server.js";
import { doctorInspectResultFromProbeRows, probeConnectedHub } from "../aggregator/upstream-probe.js";
import type { SennitConfig } from "../config/schema.js";
import { VERSION } from "../lib/version.js";

export type ServeHttpGatewayOptions = {
  host: string;
  port: number;
  mcpPath: string;
  healthPath: string;
  readyPath: string;
  /** When set, require `Authorization: Bearer <token>` on MCP routes. */
  authBearer?: string;
  /** When binding to non-localhost, pass allowed Host header values for Streamable HTTP. */
  allowedHosts?: string[];
};

type SessionRecord = {
  transport: StreamableHTTPServerTransport;
  mcp: McpServer;
  detach: () => void;
};

function bodyLooksLikeInitialize(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some((m) => isInitializeRequest(m));
  }
  return isInitializeRequest(body);
}

/**
 * One shared upstream hub; one MCP {@link McpServer} + Streamable HTTP transport per connected client session.
 */
export async function startServeHttpGateway(
  config: SennitConfig,
  options: ServeHttpGatewayOptions,
): Promise<{ server: Server; close: () => Promise<void> }> {
  const { hub, rootsBridge, toolCatalogs, promptCatalogs } = await connectAggregatedHub(config);

  const sessions = new Map<string, SessionRecord>();

  const app = express();
  app.use(express.json({ limit: "4mb" }));

  app.get(options.healthPath, (_req, res) => {
    res.status(200).type("text/plain").send("ok");
  });

  app.get(options.readyPath, async (_req, res) => {
    try {
      const rows = await probeConnectedHub(hub);
      const inspect = doctorInspectResultFromProbeRows(rows);
      if (inspect.ok) {
        res.status(200).type("text/plain").send("ready");
        return;
      }
      res.status(503).type("text/plain").send("not_ready");
      return;
    } catch {
      res.status(503).type("text/plain").send("not_ready");
      return;
    }
  });

  const bearer = options.authBearer;
  const mcpAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void => {
    if (!bearer) {
      next();
      return;
    }
    const h = req.headers.authorization;
    const want = `Bearer ${bearer}`;
    if (h !== want) {
      res.status(401).type("text/plain").send("unauthorized");
      return;
    }
    next();
  };

  async function spawnSession(): Promise<SessionRecord> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      ...(options.allowedHosts && options.allowedHosts.length > 0
        ? {
            enableDnsRebindingProtection: true,
            allowedHosts: options.allowedHosts,
          }
        : {}),
    });
    const mcp = new McpServer(
      { name: "sennit", version: VERSION },
      { capabilities: { tools: {}, prompts: {} } },
    );
    await registerAggregatorSurface(mcp, hub, config, toolCatalogs, promptCatalogs, rootsBridge);
    const detach = attachHostListChangedSubscriptions(mcp, hub.listChangedFanout, config);
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid) {
        sessions.delete(sid);
      }
      detach();
      void mcp.close().catch(() => undefined);
    };
    await mcp.connect(transport);
    return { transport, mcp, detach };
  }

  const mountPath = options.mcpPath.endsWith("/") ? options.mcpPath.slice(0, -1) : options.mcpPath;

  app.all(mountPath, mcpAuth, async (req, res) => {
    try {
      const sidHeader =
        typeof req.headers["mcp-session-id"] === "string" ? req.headers["mcp-session-id"] : undefined;
      const init = req.method === "POST" && bodyLooksLikeInitialize(req.body);

      if (req.method === "POST" && init && !sidHeader) {
        const session = await spawnSession();
        await session.transport.handleRequest(req, res, req.body);
        const sid = session.transport.sessionId;
        if (sid) {
          sessions.set(sid, session);
        }
        return;
      }

      if (!sidHeader) {
        res.status(400).type("text/plain").send("missing Mcp-Session-Id");
        return;
      }

      const session = sessions.get(sidHeader);
      if (!session) {
        res.status(404).type("text/plain").send("session not found");
        return;
      }

      if (req.method === "POST") {
        await session.transport.handleRequest(req, res, req.body);
        return;
      }
      await session.transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) {
        res.status(500).type("text/plain").send("internal_error");
      }
    }
  });

  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(options.port, options.host, () => resolve(s));
    s.on("error", reject);
  });

  return {
    server,
    close: async () => {
      await Promise.all(
        [...sessions.values()].map(async (s) => {
          s.detach();
          await s.transport.close().catch(() => undefined);
          await s.mcp.close().catch(() => undefined);
        }),
      );
      sessions.clear();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      await hub.close();
    },
  };
}
