import type { Command } from "commander";
import { jsonText } from "../../lib/json-text.js";
import { resolveConfigPath } from "../paths.js";

export function registerOnboard(program: Command): void {
  program
    .command("onboard")
    .description(
      "Print example host MCP snippet; use `sennit config path` for the default config file location",
    )
    .option("-c, --config <path>", "Config path to embed in snippet")
    .action((opts: { config?: string }) => {
      const resolved =
        resolveConfigPath(opts.config) ?? "<path-to-sennit.config.yaml>";
      const snippet = {
        mcpServers: {
          sennit: {
            command: "npx",
            args: ["-y", "sennit", "serve", "--config", resolved],
          },
        },
      };
      process.stdout.write(
        "Paste into your host MCP config (e.g. Cursor User mcp.json). Adjust the config path.\n\n",
      );
      process.stdout.write(`${jsonText(snippet)}\n`);
    });
}
