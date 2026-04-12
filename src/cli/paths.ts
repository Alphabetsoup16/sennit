import { existsSync } from "node:fs";
import { join } from "node:path";

/** Resolve config path: `--config`, `SENNIT_CONFIG`, or `./sennit.config.ya?ml`. */
export function resolveConfigPath(explicit?: string): string | undefined {
  if (explicit) {
    return explicit;
  }
  const env = process.env.SENNIT_CONFIG;
  if (env) {
    return env;
  }
  for (const name of ["sennit.config.yaml", "sennit.config.yml"]) {
    const p = join(process.cwd(), name);
    if (existsSync(p)) {
      return p;
    }
  }
  return undefined;
}
