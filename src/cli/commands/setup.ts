import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { Command } from "commander";
import YAML from "yaml";
import type { SennitConfig } from "../../config/schema.js";
import { sennitConfigSchema } from "../../config/schema.js";
import { errorMessage } from "../../lib/error-message.js";
import { EMPTY_CONFIG } from "../load-config.js";
import { importServersFromHostMcpJson } from "../import-host-mcp.js";
import { defaultUserSennitConfigFile } from "../user-sennit-paths.js";

export function registerSetup(program: Command): void {
  program
    .command("setup")
    .description(
      "Create per-user config and/or import upstreams from a host mcp.json (Cursor-style)",
    )
    .option("--from <path>", "Import mcpServers from host JSON (stdio + streamableHttp/sse)")
    .option("-o, --output <path>", "Write config here (default: per-user config.yaml)")
    .option("-f, --force", "Overwrite output if it already exists")
    .action(
      (opts: { from?: string; output?: string; force?: boolean }) => {
        const outPath = opts.output ?? defaultUserSennitConfigFile();

        if (existsSync(outPath) && !opts.force) {
          process.stderr.write(
            `Config already exists: ${outPath}\n` +
              `Use --force to overwrite, or -o <path> for a different file.\n`,
          );
          process.exitCode = 1;
          return;
        }

        let config: SennitConfig = EMPTY_CONFIG;
        const notes: string[] = [];

        if (opts.from) {
          const raw = readFileSync(opts.from, "utf8");
          let parsed: unknown;
          try {
            parsed = JSON.parse(raw) as unknown;
          } catch (e) {
            const msg = errorMessage(e);
            process.stderr.write(`Invalid JSON in ${opts.from}: ${msg}\n`);
            process.exitCode = 1;
            return;
          }
          const { servers, skipped } = importServersFromHostMcpJson(parsed);
          for (const s of skipped) {
            notes.push(`  skipped "${s.key}": ${s.reason}`);
          }
          if (Object.keys(servers).length === 0) {
            process.stderr.write(
              `No servers imported from ${opts.from}. ` +
                `Host files must use { "mcpServers": { "name": { "command" | "url", ... } } }.\n`,
            );
            if (notes.length > 0) {
              process.stderr.write(`Details:\n${notes.join("\n")}\n`);
            }
            process.exitCode = 1;
            return;
          }
          config = sennitConfigSchema.parse({ version: 1, servers });
        }

        mkdirSync(dirname(outPath), { recursive: true });
        const body =
          "# Sennit — upstream MCP servers (stdio/streamableHttp/sse). See https://github.com/Alphabetsoup16/sennit\n" +
          YAML.stringify(config, { indent: 2 });
        writeFileSync(outPath, body, "utf8");

        process.stdout.write(`Wrote ${outPath}\n`);
        if (notes.length > 0) {
          process.stdout.write("Import notes:\n");
          process.stdout.write(`${notes.join("\n")}\n`);
        }
        process.stdout.write("\nNext:\n");
        process.stdout.write(`  npx sennit doctor\n`);
        process.stdout.write(`  npx sennit onboard --config ${outPath}\n`);
        process.stdout.write(`  npx sennit config path   # show default path anytime\n`);
      },
    );
}
