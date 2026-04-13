import type { Command } from "commander";
import { errorMessage } from "../../lib/error-message.js";
import {
  DESC_CONFIG_PATH_RESOLVE,
  DESC_JSON,
  DESC_TIMEOUT_INSPECT,
  OPT_CONFIG_PATH,
  OPT_JSON,
  OPT_TIMEOUT_MS,
} from "../cli-shared-options.js";
import { loadSennitConfig } from "../load-config.js";
import { runDoctorInspect } from "../inspect-upstreams.js";
import {
  DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS,
  parseRequiredPositiveMs,
} from "../parse-timeout-ms.js";
import { cliJsonOrHuman } from "../print.js";
import { resolveConfigPath } from "../paths.js";

export function registerDoctorInspect(doctor: Command): void {
  doctor
    .command("inspect")
    .description(
      "Connect to each stdio upstream and run MCP tools/list (live; use for debugging)",
    )
    .option(OPT_CONFIG_PATH, DESC_CONFIG_PATH_RESOLVE)
    .option(OPT_JSON, DESC_JSON)
    .option(
      OPT_TIMEOUT_MS,
      DESC_TIMEOUT_INSPECT,
      String(DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS),
    )
    .action(async (opts: { config?: string; json?: boolean; timeout: string }) => {
      let timeoutMs: number;
      try {
        timeoutMs = parseRequiredPositiveMs(opts.timeout, "--timeout");
      } catch (e) {
        const msg = errorMessage(e);
        process.stderr.write(`${msg}\n`);
        process.exitCode = 1;
        return;
      }

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
          if (result.fatalError) {
            process.stdout.write(`  fatal: ${result.fatalError}\n`);
          }
          for (const u of result.upstreams) {
            if (u.ok) {
              process.stdout.write(
                `  ${u.serverKey}: ok (${u.toolCount ?? 0} tools) — ${(u.toolNames ?? []).join(", ") || "(none)"}\n`,
              );
            } else {
              process.stdout.write(`  ${u.serverKey}: error — ${u.error ?? "unknown"}\n`);
            }
          }
          if (result.upstreams.length === 0 && !result.fatalError) {
            process.stdout.write("  (no upstream servers configured)\n");
          }
          process.stdout.write(`  status: ${effectiveOk ? "ok" : "issues found"}\n`);
        },
      });

      if (!effectiveOk) {
        process.exitCode = 2;
      }
    });
}
