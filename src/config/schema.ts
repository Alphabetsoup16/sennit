import { z } from "zod";
import { TOOL_NAMESPACE_SEPARATOR } from "../lib/namespace.js";

/** How Sennit answers upstream `roots/list` using the host’s roots (see docs/PASSTHROUGH-AND-MERGE.md). */
export const rootsPolicySchema = z.object({
  mode: z.enum(["ignore", "forward", "intersect"]),
  /** Required when `mode` is `intersect`: only roots whose `uri` starts with one of these strings are forwarded. */
  allowUriPrefixes: z.array(z.string()).optional(),
});

export type RootsPolicy = z.infer<typeof rootsPolicySchema>;

/** One stdio-backed upstream MCP server. */
export const stdioServerSchema = z.object({
  transport: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
  /** If set, only these upstream tool names are exposed. */
  tools: z.array(z.string()).optional(),
});

export type StdioServerConfig = z.infer<typeof stdioServerSchema>;

export const sennitConfigSchema = z
  .object({
    version: z.literal(1),
    servers: z.record(z.string(), stdioServerSchema).default({}),
    roots: rootsPolicySchema.default({ mode: "ignore" }),
  })
  .superRefine((data, ctx) => {
    for (const key of Object.keys(data.servers)) {
      if (key.includes(TOOL_NAMESPACE_SEPARATOR)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `server key must not contain "${TOOL_NAMESPACE_SEPARATOR}" (reserved for tool namespacing): ${JSON.stringify(key)}`,
          path: ["servers", key],
        });
      }
    }
    if (data.roots.mode === "intersect") {
      const p = data.roots.allowUriPrefixes;
      if (!p || p.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'roots.allowUriPrefixes is required when roots.mode is "intersect"',
          path: ["roots", "allowUriPrefixes"],
        });
      }
    }
  });

export type SennitConfig = z.infer<typeof sennitConfigSchema>;
