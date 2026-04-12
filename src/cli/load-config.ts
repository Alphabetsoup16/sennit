import { loadConfigFile } from "../config/load.js";
import type { SennitConfig } from "../config/schema.js";
import { sennitConfigSchema } from "../config/schema.js";

/** Empty config when no file is provided or found. */
export const EMPTY_CONFIG: SennitConfig = sennitConfigSchema.parse({
  version: 1,
  servers: {},
});

export function loadSennitConfig(path?: string): SennitConfig {
  if (!path) {
    return EMPTY_CONFIG;
  }
  return loadConfigFile(path);
}

export function tryLoadSennitConfig(
  path: string,
): { ok: true } | { ok: false; error: string } {
  try {
    loadSennitConfig(path);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
