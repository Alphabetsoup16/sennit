import type { Command } from "commander";
import { VERSION } from "../../lib/version.js";
import { tryLoadSennitConfig } from "../load-config.js";
import { printJson } from "../print.js";
import { resolveConfigPath } from "../paths.js";

export function registerDoctor(program: Command): void {
  program
    .command("doctor")
    .description("Print environment and config diagnostics")
    .option("-c, --config <path>", "Optional config to validate")
    .option("--json", "Machine-readable output")
    .action((opts: { config?: string; json?: boolean }) => {
      const resolved = resolveConfigPath(opts.config);
      const payload = {
        schemaVersion: 1,
        ok: true,
        sennitVersion: VERSION,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd(),
        configPath: resolved ?? null,
        configLoaded: false as boolean,
        configError: null as string | null,
      };

      if (resolved) {
        const r = tryLoadSennitConfig(resolved);
        payload.configLoaded = r.ok;
        if (!r.ok) {
          payload.ok = false;
          payload.configError = r.error;
        }
      }

      if (opts.json) {
        printJson(payload);
      } else {
        process.stdout.write(`Sennit ${VERSION} doctor\n`);
        process.stdout.write(`  Node: ${payload.node}  (${payload.platform}/${payload.arch})\n`);
        process.stdout.write(`  cwd: ${payload.cwd}\n`);
        process.stdout.write(
          `  config: ${resolved ?? "(none — using empty servers)"}\n`,
        );
        if (resolved) {
          process.stdout.write(
            `  config valid: ${payload.configLoaded ? "yes" : `no — ${payload.configError}`}\n`,
          );
        }
        process.stdout.write(`  status: ${payload.ok ? "ok" : "issues found"}\n`);
      }
      if (!payload.ok) {
        process.exitCode = 2;
      }
    });
}
