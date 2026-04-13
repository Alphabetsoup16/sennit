import type { StdioServerConfig } from "../config/schema.js";

export type ImportHostMcpSkip = { key: string; reason: string };

/** Cursor-style host MCP file: `{ "mcpServers": { "name": { command, args?, env? } } }`. */
export function importStdioServersFromHostMcpJson(
  data: unknown,
): { servers: Record<string, StdioServerConfig>; skipped: ImportHostMcpSkip[] } {
  const skipped: ImportHostMcpSkip[] = [];
  if (!data || typeof data !== "object") {
    skipped.push({ key: "(root)", reason: "not a JSON object" });
    return { servers: {}, skipped };
  }
  const root = data as Record<string, unknown>;
  const raw = root.mcpServers;
  if (!raw || typeof raw !== "object") {
    skipped.push({ key: "(root)", reason: "missing mcpServers object" });
    return { servers: {}, skipped };
  }

  const servers: Record<string, StdioServerConfig> = {};

  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") {
      skipped.push({ key, reason: "not an object" });
      continue;
    }
    const e = entry as Record<string, unknown>;
    const command = e.command;
    if (typeof command !== "string" || command.length === 0) {
      skipped.push({ key, reason: "no command (stdio only)" });
      continue;
    }
    if (typeof e.url === "string" && e.url.length > 0) {
      skipped.push({ key, reason: "has url (remote/SSE — not stdio)" });
      continue;
    }

    const args = normalizeStringArray(e.args);
    if (looksLikeSennitServe(command, args)) {
      skipped.push({ key, reason: "looks like Sennit itself (avoid nesting)" });
      continue;
    }

    const env = normalizeEnv(e.env);
    const cwd = typeof e.cwd === "string" && e.cwd.length > 0 ? e.cwd : undefined;

    servers[key] = {
      transport: "stdio",
      command,
      args,
      ...(env ? { env } : {}),
      ...(cwd ? { cwd } : {}),
    };
  }

  return { servers, skipped };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((x): x is string => typeof x === "string");
}

function normalizeEnv(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Heuristic: host config often defines Sennit via `npx -y sennit serve`.
 * Used to avoid importing a nested Sennit entry from another host file.
 */
export function looksLikeSennitServe(command: string, args: string[]): boolean {
  const joined = [command, ...args].join(" ");
  if (!/\bserve\b/.test(joined)) {
    return false;
  }
  return /\bsennit\b/.test(joined);
}
