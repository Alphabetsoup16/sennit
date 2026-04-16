import type { Command } from "commander";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAggregator } from "../../aggregator/build-server.js";
import { errorMessage } from "../../lib/error-message.js";
import { loadSennitConfig } from "../load-config.js";
import { resolveConfigPath } from "../paths.js";
import { startServeHttpGateway } from "../serve-http-gateway.js";

export function registerServe(program: Command): void {
  program
    .command("serve")
    .description(
      "Run the aggregator MCP server on stdio (default) or Streamable HTTP (gateway). Use `sennit plan` for a dry-run preview.",
    )
    .option("-c, --config <path>", "Path to sennit.config.yaml / .json")
    .option("--http-port <port>", "Listen for Streamable HTTP MCP on this port (enables HTTP mode)", (v) =>
      parseInt(v, 10),
    )
    .option("--http-host <host>", "Bind address for HTTP mode", "127.0.0.1")
    .option("--http-path <path>", "URL path for MCP (GET/POST/DELETE)", "/mcp")
    .option("--http-health-path <path>", "Health probe path (always 200 if process is up)", "/healthz")
    .option("--http-ready-path <path>", "Readiness path (503 if upstream probe was not ok)", "/ready")
    .option(
      "--http-bearer <token>",
      "Require Authorization: Bearer token on MCP routes (optional; omit in dev)",
    )
    .option(
      "--http-allowed-host <host>",
      "Allowed Host header value (repeatable; use when binding to 0.0.0.0 with DNS rebinding protection)",
      (v: string, prev: string[]) => [...prev, v],
      [] as string[],
    )
    .action(
      async (opts: {
        config?: string;
        httpPort?: number;
        httpHost: string;
        httpPath: string;
        httpHealthPath: string;
        httpReadyPath: string;
        httpBearer?: string;
        httpAllowedHost: string[];
      }) => {
        try {
          const resolved = resolveConfigPath(opts.config);
          const config = loadSennitConfig(resolved);

          if (opts.httpPort !== undefined) {
            if (!Number.isFinite(opts.httpPort) || opts.httpPort <= 0) {
              throw new Error("invalid --http-port");
            }
            const gateway = await startServeHttpGateway(config, {
              host: opts.httpHost,
              port: opts.httpPort,
              mcpPath: opts.httpPath,
              healthPath: opts.httpHealthPath,
              readyPath: opts.httpReadyPath,
              authBearer: opts.httpBearer,
              allowedHosts: opts.httpAllowedHost.length > 0 ? opts.httpAllowedHost : undefined,
            });
            process.stderr.write(
              `sennit: Streamable HTTP MCP on http://${opts.httpHost}:${opts.httpPort}${opts.httpPath}\n`,
            );

            const shutdown = async () => {
              await gateway.close();
              process.exit(0);
            };
            process.once("SIGINT", () => void shutdown());
            process.once("SIGTERM", () => void shutdown());
            return;
          }

          const handle = await createAggregator(config);
          await handle.mcp.connect(new StdioServerTransport());

          const shutdown = async () => {
            await handle.close();
            process.exit(0);
          };
          process.once("SIGINT", () => void shutdown());
          process.once("SIGTERM", () => void shutdown());
        } catch (e) {
          process.stderr.write(`${errorMessage(e)}\n`);
          process.exitCode = 1;
        }
      },
    );
}
