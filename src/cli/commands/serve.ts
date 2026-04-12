import type { Command } from "commander";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAggregator } from "../../aggregator/build-server.js";
import { loadSennitConfig } from "../load-config.js";
import { resolveConfigPath } from "../paths.js";

export function registerServe(program: Command): void {
  program
    .command("serve")
    .description("Run the aggregator MCP server on stdio (for IDE / host)")
    .option("-c, --config <path>", "Path to sennit.config.yaml / .json")
    .action(async (opts: { config?: string }) => {
      const resolved = resolveConfigPath(opts.config);
      const config = loadSennitConfig(resolved);
      const handle = await createAggregator(config);
      await handle.mcp.connect(new StdioServerTransport());

      const shutdown = async () => {
        await handle.close();
        process.exit(0);
      };
      process.once("SIGINT", () => void shutdown());
      process.once("SIGTERM", () => void shutdown());
    });
}
