import type { Command } from "commander";
import YAML from "yaml";
import {
  DESC_CONFIG_PATH_RESOLVE,
  DESC_JSON,
  DESC_TIMEOUT_INSPECT,
  OPT_CONFIG_PATH,
  OPT_JSON,
  OPT_TIMEOUT_MS,
} from "../cli-shared-options.js";
import { tryParsePlanInspectTimeout } from "../cli-timeout.js";
import { formatInspectUpstreamsHumanLines } from "../format-inspect-upstreams.js";
import { loadSennitConfig } from "../load-config.js";
import { planOverallOk, runPlan } from "../plan-run.js";
import { DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS } from "../parse-timeout-ms.js";
import { printJson } from "../print.js";
import { resolveConfigPath } from "../paths.js";

export function registerPlan(program: Command): void {
  program
    .command("plan")
    .description(
      "Dry-run: resolved config (redacted), per-upstream tools/list + resources/list, merged host-facing tool and resource catalogs",
    )
    .option(OPT_CONFIG_PATH, DESC_CONFIG_PATH_RESOLVE)
    .option(OPT_JSON, DESC_JSON)
    .option(
      OPT_TIMEOUT_MS,
      DESC_TIMEOUT_INSPECT,
      String(DEFAULT_DOCTOR_INSPECT_TIMEOUT_MS),
    )
    .action(async (opts: { config?: string; json?: boolean; timeout: string }) => {
      const parsed = tryParsePlanInspectTimeout(opts.timeout);
      if (!parsed.ok) {
        process.stderr.write(`${parsed.message}\n`);
        process.exitCode = 1;
        return;
      }
      const timeoutMs = parsed.ms;

      const resolved = resolveConfigPath(opts.config);
      const config = loadSennitConfig(resolved);
      const result = await runPlan(resolved ?? null, config, timeoutMs);
      const ok = planOverallOk(result);

      if (opts.json) {
        printJson(result);
      } else {
        process.stdout.write("Sennit plan (dry-run)\n");
        process.stdout.write(
          `  config: ${resolved ?? "(none — empty servers)"}\n  inspect timeout: ${timeoutMs}ms\n\n`,
        );
        process.stdout.write("## Resolved config (roots allowUriPrefixes + env redacted)\n");
        process.stdout.write(YAML.stringify(result.config, { indent: 2 }));
        process.stdout.write("\n## Upstream reachability (raw tools/list; resources/list when supported)\n");
        for (const line of formatInspectUpstreamsHumanLines(result.inspect.upstreams, {
          fatalError: result.inspect.fatalError,
        })) {
          process.stdout.write(`${line}\n`);
        }
        process.stdout.write("\n## Merged tool catalog (host-facing)\n");
        if (result.mergedError) {
          process.stdout.write(`  error: ${result.mergedError}\n`);
        } else if (result.mergedTools) {
          process.stdout.write(`  count: ${result.mergedTools.length}\n`);
          for (const t of result.mergedTools) {
            const desc = t.description ? ` — ${t.description}` : "";
            process.stdout.write(`  ${t.name}${desc}\n`);
          }
        }
        process.stdout.write("\n## Merged resource catalog (host-facing)\n");
        if (result.mergedError) {
          process.stdout.write(`  (skipped — aggregator error above)\n`);
        } else if (result.mergedResources) {
          process.stdout.write(`  count: ${result.mergedResources.length}\n`);
          for (const r of result.mergedResources) {
            const desc = r.description ? ` — ${r.description}` : "";
            process.stdout.write(`  ${r.name} <${r.uri}>${desc}\n`);
          }
        }
        process.stdout.write(`\nstatus: ${ok ? "ok" : "issues found"}\n`);
      }

      if (!ok) {
        process.exitCode = 2;
      }
    });
}
