import type { SennitConfig } from "../config/schema.js";

export const REDACTED_VALUE = "[redacted]";

/** Deep clone; redact `servers.*.env` values and `roots.allowUriPrefixes` for safe printing. */
export function redactSennitConfig(config: SennitConfig): SennitConfig {
  const next = structuredClone(config);
  for (const server of Object.values(next.servers)) {
    if (!server.env) {
      continue;
    }
    for (const k of Object.keys(server.env)) {
      server.env[k] = REDACTED_VALUE;
    }
  }
  if (next.roots.allowUriPrefixes?.length) {
    next.roots = {
      ...next.roots,
      allowUriPrefixes: next.roots.allowUriPrefixes.map(() => REDACTED_VALUE),
    };
  }
  return next;
}
