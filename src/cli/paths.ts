import { existsSync } from "node:fs";
import { join } from "node:path";
import { defaultUserSennitConfigFile } from "./user-sennit-paths.js";

/**
 * Resolve config path (first match):
 * explicit → `SENNIT_CONFIG` → `./sennit.config.ya?ml` (cwd) → per-user `config.yaml`.
 */
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
  const userFile = defaultUserSennitConfigFile();
  if (existsSync(userFile)) {
    return userFile;
  }
  return undefined;
}
