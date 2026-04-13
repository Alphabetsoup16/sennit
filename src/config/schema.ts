import { z } from "zod";
import { TOOL_NAMESPACE_SEPARATOR } from "../lib/namespace.js";

const rootRewriteRuleSchema = z.object({
  /** Host root URI must start with this prefix to be rewritten. Longest matching prefix wins. */
  fromPrefix: z.string().min(1),
  /** Replacement for the matched prefix (may be empty to strip). */
  toPrefix: z.string(),
});

/** How Sennit answers upstream `roots/list` using the host’s roots (maintainer contract: private-docs/PASSTHROUGH-AND-MERGE.md). */
export const rootsPolicySchema = z.object({
  mode: z.enum(["ignore", "forward", "intersect"]),
  /** Required when `mode` is `intersect`: only roots whose `uri` starts with one of these strings are forwarded. */
  allowUriPrefixes: z.array(z.string()).optional(),
  /**
   * After `forward` / `intersect` filtering, rewrite matching root URIs per upstream `serverKey`.
   * Rules are applied longest-`fromPrefix` first for that server.
   */
  mapByUpstream: z.record(z.string(), z.array(rootRewriteRuleSchema)).optional(),
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
  /** If set, only static resources whose upstream URI is listed are exposed (exact match). */
  resources: z.array(z.string()).optional(),
  /** If set, only these upstream resource template URI patterns are exposed (exact `uriTemplate` match). */
  resourceTemplates: z.array(z.string()).optional(),
  /** If set, only these upstream prompt names are exposed (from `prompts/list`). */
  prompts: z.array(z.string()).optional(),
  /**
   * When true, this upstream is not spawned during `connect()`; the first probe or proxied call
   * connects it (see `idleTimeoutMs` for disconnect-after-idle).
   */
  lazy: z.boolean().optional(),
  /**
   * After this many milliseconds without a proxied operation touching this upstream, disconnect
   * it (the merged tool/resource/prompt catalog stays; the next call reconnects).
   */
  idleTimeoutMs: z.number().int().positive().optional(),
  /**
   * Abort each proxied upstream `tools/call` after this many milliseconds (omit for no limit).
   * Uses the MCP client `AbortSignal` so the SDK sends `notifications/cancelled` for the JSON-RPC request.
   */
  toolCallTimeoutMs: z.number().int().positive().optional(),
});

export type StdioServerConfig = z.infer<typeof stdioServerSchema>;

const streamableHttpReconnectionSchema = z
  .object({
    maxRetries: z.number().int().min(0).optional(),
    initialReconnectionDelay: z.number().int().positive().optional(),
    maxReconnectionDelay: z.number().int().positive().optional(),
    reconnectionDelayGrowFactor: z.number().positive().optional(),
  })
  .optional();

/** Remote upstream using Streamable HTTP (MCP client transport). */
export const streamableHttpServerSchema = z.object({
  transport: z.literal("streamableHttp"),
  url: z.string().url(),
  /** Sent as HTTP headers on each MCP request (values redacted in `sennit plan` / `config print`). */
  headers: z.record(z.string(), z.string()).optional(),
  /** If set, each HTTP request uses this wall-clock budget (via `fetch` abort). Omit for platform default. */
  httpRequestTimeoutMs: z.number().int().positive().optional(),
  /** Override Streamable HTTP transport reconnection backoff (see MCP SDK `reconnectionOptions`). */
  streamableHttpReconnection: streamableHttpReconnectionSchema,
  /** If set, only these upstream tool names are exposed. */
  tools: z.array(z.string()).optional(),
  /** If set, only these upstream resource URIs are exposed (exact match). */
  resources: z.array(z.string()).optional(),
  /** If set, only these upstream resource template URI patterns are exposed (exact `uriTemplate` match). */
  resourceTemplates: z.array(z.string()).optional(),
  /** If set, only these upstream prompt names are exposed. */
  prompts: z.array(z.string()).optional(),
  lazy: z.boolean().optional(),
  idleTimeoutMs: z.number().int().positive().optional(),
  /**
   * Abort each proxied upstream `tools/call` after this many milliseconds (omit for no limit).
   * Uses the MCP client `AbortSignal` so the SDK sends `notifications/cancelled` for the JSON-RPC request.
   */
  toolCallTimeoutMs: z.number().int().positive().optional(),
});

export type StreamableHttpServerConfig = z.infer<typeof streamableHttpServerSchema>;

/** Legacy SSE remote upstream (deprecated in MCP SDK; use `streamableHttp` when possible). */
export const sseServerSchema = z.object({
  transport: z.literal("sse"),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  httpRequestTimeoutMs: z.number().int().positive().optional(),
  tools: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
  resourceTemplates: z.array(z.string()).optional(),
  prompts: z.array(z.string()).optional(),
  lazy: z.boolean().optional(),
  idleTimeoutMs: z.number().int().positive().optional(),
  /**
   * Abort each proxied upstream `tools/call` after this many milliseconds (omit for no limit).
   * Uses the MCP client `AbortSignal` so the SDK sends `notifications/cancelled` for the JSON-RPC request.
   */
  toolCallTimeoutMs: z.number().int().positive().optional(),
});

export type SseServerConfig = z.infer<typeof sseServerSchema>;

export const serverEntrySchema = z.discriminatedUnion("transport", [
  stdioServerSchema,
  streamableHttpServerSchema,
  sseServerSchema,
]);

export type ServerEntryConfig = z.infer<typeof serverEntrySchema>;

export const sennitConfigSchema = z
  .object({
    version: z.literal(1),
    servers: z.record(z.string(), serverEntrySchema).default({}),
    roots: rootsPolicySchema.default({ mode: "ignore" }),
    /**
     * When set, proxied tool descriptions in the merged `tools/list` are truncated to this many
     * Unicode code units (ellipsis appended). Omit for full upstream descriptions.
     */
    toolsListDescriptionMaxChars: z.number().int().positive().optional(),
    /**
     * When true, subscribe to upstream `notifications/tools/list_changed` (if advertised) and call
     * the host `sendToolListChanged`. Merged tool registrations are still fixed until reconnect.
     */
    dynamicToolList: z.boolean().optional(),
    /**
     * When true, subscribe to upstream `notifications/resources/list_changed` (if advertised) and call
     * `sendResourceListChanged` on the host. Merged resource registrations stay fixed until reconnect.
     */
    dynamicResourceList: z.boolean().optional(),
    /**
     * When true, subscribe to upstream `notifications/prompts/list_changed` (if advertised) and call
     * `sendPromptListChanged` on the host. Merged prompt registrations stay fixed until reconnect.
     */
    dynamicPromptList: z.boolean().optional(),
    /**
     * Cap concurrent upstream `tools/call` operations started from a single `sennit.batch_call` request.
     * Omit for unbounded parallelism (subject to `BATCH_CALL_MAX_ITEMS`).
     */
    batchCallMaxConcurrency: z.number().int().positive().optional(),
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
