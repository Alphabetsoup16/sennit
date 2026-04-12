import type { Command } from "commander";
import { tryLoadSennitConfig } from "../load-config.js";
import { printJson } from "../print.js";

export function registerConfigValidate(parent: Command): void {
  parent
    .command("validate")
    .description("Validate a config file (exit 2 on error)")
    .requiredOption("-c, --config <path>", "Path to config file")
    .option("--json", "Machine-readable output")
    .action((opts: { config: string; json?: boolean }) => {
      const r = tryLoadSennitConfig(opts.config);
      if (r.ok) {
        if (opts.json) {
          printJson({ schemaVersion: 1, ok: true, path: opts.config });
        } else {
          process.stdout.write(`OK: ${opts.config}\n`);
        }
        return;
      }
      if (opts.json) {
        printJson({
          schemaVersion: 1,
          ok: false,
          path: opts.config,
          error: r.error,
        });
      } else {
        process.stderr.write(`Invalid config: ${r.error}\n`);
      }
      process.exitCode = 2;
    });
}
