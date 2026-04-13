import { existsSync } from "node:fs";
import type { Command } from "commander";
import { VERSION } from "../../lib/version.js";
import { tryLoadSennitConfig } from "../load-config.js";
import { cliJsonOrHuman } from "../print.js";
import { resolveConfigPath } from "../paths.js";
import { defaultUserSennitConfigFile } from "../user-sennit-paths.js";
import { registerDoctorInspect } from "./doctor-inspect.js";

export function registerDoctor(program: Command): void {
  const doctor = program
    .command("doctor")
    .description("Environment and config diagnostics (see `doctor inspect` for live upstreams)");

  doctor
    .option("-c, --config <path>", "Optional config path (default: same resolution as serve)")
    .option("--json", "Machine-readable output")
    .action((opts: { config?: string; json?: boolean }) => {
      const resolved = resolveConfigPath(opts.config);
      const userDefault = defaultUserSennitConfigFile();

      let rootsSummary: { mode: string; allowUriPrefixCount: number } | null = null;
      let configLoaded = false;
      let configError: string | null = null;

      if (resolved) {
        const r = tryLoadSennitConfig(resolved);
        configLoaded = r.ok;
        if (r.ok) {
          rootsSummary = {
            mode: r.config.roots.mode,
            allowUriPrefixCount: r.config.roots.allowUriPrefixes?.length ?? 0,
          };
        } else {
          configError = r.error;
        }
      } else {
        rootsSummary = { mode: "ignore", allowUriPrefixCount: 0 };
      }

      const payload = {
        schemaVersion: 1,
        ok: configError === null,
        sennitVersion: VERSION,
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cwd: process.cwd(),
        configPath: resolved ?? null,
        userConfigDefaultPath: userDefault,
        userConfigDefaultExists: existsSync(userDefault),
        configLoaded,
        configError,
        roots: rootsSummary,
      };

      cliJsonOrHuman({
        json: opts.json,
        jsonPayload: payload,
        writeHuman: () => {
          process.stdout.write(`Sennit ${VERSION} doctor\n`);
          process.stdout.write(`  Node: ${payload.node}  (${payload.platform}/${payload.arch})\n`);
          process.stdout.write(`  cwd: ${payload.cwd}\n`);
          process.stdout.write(
            `  config: ${resolved ?? "(none — using empty servers)"}\n`,
          );
          process.stdout.write(`  user default: ${userDefault}\n`);
          process.stdout.write(
            `  user default exists: ${payload.userConfigDefaultExists ? "yes" : "no"} (see \`sennit setup\`)\n`,
          );
          if (rootsSummary) {
            process.stdout.write(
              `  roots: mode=${rootsSummary.mode}` +
                (rootsSummary.allowUriPrefixCount > 0
                  ? ` (${rootsSummary.allowUriPrefixCount} allowUriPrefixes)`
                  : "") +
                "\n",
            );
          } else if (resolved) {
            process.stdout.write("  roots: (unavailable — fix config errors)\n");
          }
          if (resolved) {
            process.stdout.write(
              `  config valid: ${configLoaded ? "yes" : `no — ${configError}`}\n`,
            );
          }
          process.stdout.write(`  status: ${payload.ok ? "ok" : "issues found"}\n`);
        },
      });
      if (!payload.ok) {
        process.exitCode = 2;
      }
    });

  registerDoctorInspect(doctor);
}
