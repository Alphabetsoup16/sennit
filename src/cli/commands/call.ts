import type { Command } from "commander";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAggregator } from "../../aggregator/build-server.js";
import { errorMessage } from "../../lib/error-message.js";
import {
  DESC_CONFIG_PATH_RESOLVE,
  OPT_CONFIG_PATH,
} from "../cli-shared-options.js";
import { loadSennitConfig } from "../load-config.js";
import { printJson } from "../print.js";
import { resolveConfigPath } from "../paths.js";

export function registerCall(program: Command): void {
  program
    .command("call")
    .description(
      "Invoke one host-facing MCP tools/call in-process (merged tool name, e.g. mock__mock.ping or sennit.meta)",
    )
    .argument("<tool>", "Tool name as seen on the Sennit server")
    .option(OPT_CONFIG_PATH, DESC_CONFIG_PATH_RESOLVE)
    .option("--args <json>", "JSON object for tool arguments", "{}")
    .option("--json", "Emit { schemaVersion, tool, result } instead of raw CallToolResult")
    .action(
      async (
        tool: string,
        opts: { config?: string; args: string; json?: boolean },
      ): Promise<void> => {
        let argumentsValue: Record<string, unknown>;
        try {
          const parsed = JSON.parse(opts.args) as unknown;
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("--args must be a JSON object");
          }
          argumentsValue = parsed as Record<string, unknown>;
        } catch (e) {
          process.stderr.write(`${errorMessage(e)}\n`);
          process.exitCode = 1;
          return;
        }

        const resolved = resolveConfigPath(opts.config);
        const config = loadSennitConfig(resolved);

        try {
          const { mcp, close } = await createAggregator(config);
          try {
            const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
            await mcp.connect(serverSide);
            const client = new Client(
              { name: "sennit-call", version: "1.0.0" },
              { capabilities: {} },
            );
            await client.connect(clientSide);
            try {
              const result = await client.callTool({
                name: tool,
                arguments: argumentsValue,
              });
              if (opts.json) {
                printJson({ schemaVersion: 1, tool, result });
              } else {
                process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
              }
              if (result.isError) {
                process.exitCode = 2;
              }
            } finally {
              await client.close();
            }
          } finally {
            await close();
          }
        } catch (e) {
          process.stderr.write(`${errorMessage(e)}\n`);
          process.exitCode = 1;
        }
      },
    );
}
