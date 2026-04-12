import { z } from "zod";

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

export const sennitConfigSchema = z.object({
  version: z.literal(1),
  servers: z.record(z.string(), stdioServerSchema).default({}),
});

export type SennitConfig = z.infer<typeof sennitConfigSchema>;
