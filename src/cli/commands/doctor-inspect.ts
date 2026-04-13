import type { Command } from "commander";
import {
  DESC_CONFIG_PATH_RESOLVE,
  DESC_JSON,
  DESC_TIMEOUT_INSPECT,
  OPT_CONFIG_PATH,
  OPT_JSON,
  OPT_TIMEOUT_MS,
} from "../cli-shared-options.js";
import { tryParseDoctorInspectTimeout } from "../cli-timeout.js";
import { formatInspectUpstreamsHumanLines } from "../format-inspect-upstreams.js";
import { loadSennitConfig } from "../load-config.js";
import { runDoctorInspect } from "../inspect-upstreams.js";
import { DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS } from "../parse-timeout-ms.js";
import { cliJsonOrHuman } from "../print.js";
import { resolveConfigPath } from "../paths.js";

export function registerDoctorInspect(doctor: Command): void {
  doctor
    .command("inspect")
    .description(
      "Connect to each stdio upstream and run MCP tools/list plus resources/list when supported (live debugging)",
    )
    .option(OPT_CONFIG_PATH, DESC_CONFIG_PATH_RESOLVE)
    .option(OPT_JSON, DESC_JSON)
    .option(
      OPT_TIMEOUT_MS,
      DESC_TIMEOUT_INSPECT,
      String(DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS),
    )
    .action(async (opts: { config?: string; json?: boolean; timeout: string }) => {
      const parsed = tryParseDoctorInspectTimeout(opts.timeout);
      if (!parsed.ok) {
        process.stderr.write(`${parsed.message}\n`);
        process.exitCode = 1;
        return;
      }
      const timeoutMs = parsed.ms;

      const resolved = resolveConfigPath(opts.config);
      const config = loadSennitConfig(resolved);
      const result = await runDoctorInspect(config, timeoutMs);

      const effectiveOk = result.ok && !result.fatalError;
      cliJsonOrHuman({
        json: opts.json,
        jsonPayload: { ...result, configPath: resolved ?? null },
        writeHuman: () => {
          process.stdout.write("Sennit doctor inspect\n");
          process.stdout.write(`  config: ${resolved ?? "(none — empty servers)"}\n`);
          for (const line of formatInspectUpstreamsHumanLines(result.upstreams, {
            fatalError: result.fatalError,
          })) {
            process.stdout.write(`${line}\n`);
          }
          process.stdout.write(`  status: ${effectiveOk ? "ok" : "issues found"}\n`);
        },
      });

      if (!effectiveOk) {
        process.exitCode = 2;
      }
    });
}
