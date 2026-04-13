import { z } from "zod";

/** Permissive object args (batch_call items, or proxied tools when JSON Schema cannot be mapped). */
export const looseToolArgumentsSchema = z.record(z.string(), z.unknown());

type JsonProp = {
  type?: string;
};

/**
 * Best-effort Zod schema for a proxied tool, derived from the upstream MCP JSON Schema.
 * The MCP server SDK expects Zod (not raw JSON Schema); unknown shapes fall back to a permissive record.
 */
export function proxyToolInputSchema(inputSchema: unknown): z.ZodTypeAny {
  if (!inputSchema || typeof inputSchema !== "object") {
    return looseToolArgumentsSchema;
  }
  const root = inputSchema as Record<string, unknown>;
  if (root.type !== "object") {
    return looseToolArgumentsSchema;
  }
  const props = root.properties;
  if (!props || typeof props !== "object") {
    return looseToolArgumentsSchema;
  }
  const required = new Set(
    Array.isArray(root.required)
      ? root.required.filter((x): x is string => typeof x === "string")
      : [],
  );

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, def] of Object.entries(props as Record<string, unknown>)) {
    if (!def || typeof def !== "object") {
      continue;
    }
    const d = def as JsonProp;
    let field: z.ZodTypeAny = z.unknown();
    if (d.type === "string") {
      field = z.string();
    } else if (d.type === "number" || d.type === "integer") {
      field = z.number();
    } else if (d.type === "boolean") {
      field = z.boolean();
    }
    if (!required.has(key)) {
      field = field.optional();
    }
    shape[key] = field;
  }

  if (Object.keys(shape).length === 0) {
    return looseToolArgumentsSchema;
  }

  return z.object(shape).passthrough();
}
