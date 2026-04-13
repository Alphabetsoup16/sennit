import type { SennitConfig } from "../config/schema.js";

export const REDACTED_VALUE = "[redacted]";

function redactRecordValues(rec: Record<string, string>): void {
  for (const k of Object.keys(rec)) {
    rec[k] = REDACTED_VALUE;
  }
}

/** Deep clone; redact secrets for safe printing (`plan`, `config print`). */
export function redactSennitConfig(config: SennitConfig): SennitConfig {
  const next = structuredClone(config);
  for (const server of Object.values(next.servers)) {
    if (server.transport === "stdio" && server.env) {
      redactRecordValues(server.env);
    }
    if (
      (server.transport === "streamableHttp" || server.transport === "sse") &&
      server.headers
    ) {
      redactRecordValues(server.headers);
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
