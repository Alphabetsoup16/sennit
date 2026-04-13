import type { Command } from "commander";
import YAML from "yaml";
import {
  DESC_CONFIG_PATH_RESOLVE,
  DESC_JSON,
  OPT_CONFIG_PATH,
  OPT_JSON,
} from "../cli-shared-options.js";
import { REDACTED_VALUE, redactSennitConfig } from "../config-redact.js";
import { EMPTY_CONFIG, loadSennitConfig } from "../load-config.js";
import { cliJsonOrHuman } from "../print.js";
import { resolveConfigPath } from "../paths.js";

export function registerConfigPrint(parent: Command): void {
  parent
    .command("print")
    .description(
      "Print effective config with selective redaction (YAML or --json); use --empty for schema default. Redacts: servers.*.env values and roots.allowUriPrefixes. Does not redact command args, cwd, or other fields—review before sharing.",
    )
    .option(OPT_CONFIG_PATH, DESC_CONFIG_PATH_RESOLVE)
    .option("--empty", "Print empty schema default (ignore -c / resolution)")
    .option(OPT_JSON, DESC_JSON)
    .action((opts: { config?: string; json?: boolean; empty?: boolean }) => {
      if (opts.empty && opts.config !== undefined) {
        process.stderr.write("Cannot use --empty with -c/--config.\n");
        process.exitCode = 1;
        return;
      }

      const resolved = opts.empty ? null : resolveConfigPath(opts.config);
      const config = opts.empty ? EMPTY_CONFIG : loadSennitConfig(resolved ?? undefined);
      const safe = redactSennitConfig(config);

      cliJsonOrHuman({
        json: opts.json,
        jsonPayload: {
          schemaVersion: 1,
          configPath: resolved ?? null,
          config: safe,
        },
        writeHuman: () => {
          const header =
            `# configPath: ${opts.empty ? "(empty template)" : resolved ?? "(none — empty servers)"}\n` +
            `# env: servers.*.env values → ${REDACTED_VALUE}; roots.allowUriPrefixes entries → ${REDACTED_VALUE}\n`;
          process.stdout.write(header + YAML.stringify(safe, { indent: 2 }));
        },
      });
    });
}
