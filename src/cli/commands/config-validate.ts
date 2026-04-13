import type { Command } from "commander";
import {
  DESC_CONFIG_PATH_REQUIRED,
  DESC_JSON,
  OPT_CONFIG_PATH,
  OPT_JSON,
} from "../cli-shared-options.js";
import { tryLoadSennitConfig } from "../load-config.js";
import { cliJsonOrHuman } from "../print.js";

export function registerConfigValidate(parent: Command): void {
  parent
    .command("validate")
    .description("Validate a config file (exit 2 on error)")
    .requiredOption(OPT_CONFIG_PATH, DESC_CONFIG_PATH_REQUIRED)
    .option(OPT_JSON, DESC_JSON)
    .action((opts: { config: string; json?: boolean }) => {
      const r = tryLoadSennitConfig(opts.config);
      if (r.ok) {
        cliJsonOrHuman({
          json: opts.json,
          jsonPayload: { schemaVersion: 1, ok: true, path: opts.config },
          writeHuman: () => process.stdout.write(`OK: ${opts.config}\n`),
        });
        return;
      }
      cliJsonOrHuman({
        json: opts.json,
        jsonPayload: {
          schemaVersion: 1,
          ok: false,
          path: opts.config,
          error: r.error,
        },
        writeHuman: () => process.stderr.write(`Invalid config: ${r.error}\n`),
      });
      process.exitCode = 2;
    });
}
