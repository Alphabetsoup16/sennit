# `src/config`

Zod schema and disk load (YAML / JSON). Operators use the CLI (**`sennit config validate`**, **`plan`**, **`doctor`**); this folder is the single source of truth for shape and defaults.

| File | Role |
|------|------|
| **`schema.ts`** | **`sennitConfigSchema`**: **`version: 1`**, **`servers`** (**`stdio`** \| **`streamableHttp`** \| **`sse`**), **`roots`** (incl. **`mapByUpstream`**), optional **`toolsListDescriptionMaxChars`**, **`dynamicToolList` / `dynamicResourceList` / `dynamicPromptList`**, **`batchCallMaxConcurrency`** |
| **`load.ts`** | **`loadConfigFile`**: read by extension, **`schema.parse`** |

## `servers`

Each key is an upstream label (must not contain **`__`** — reserved for merged names).

| Transport | Typical fields |
|-----------|----------------|
| **`stdio`** | **`command`**, **`args`**, optional **`env`**, **`cwd`**, **`tools` / `resources` / `resourceTemplates` / `prompts`**, **`lazy`**, **`idleTimeoutMs`**, **`toolCallTimeoutMs`** |
| **`streamableHttp`** | **`url`** (`http`/`https` only), optional **`headers`**, **`httpRequestTimeoutMs`**, **`streamableHttpReconnection`**, same allowlists, **`lazy` / `idleTimeoutMs`**, **`toolCallTimeoutMs`** |
| **`sse`** | Legacy SSE MCP endpoint: **`url`**, optional **`headers`**, **`httpRequestTimeoutMs`**, same allowlists and lifecycle fields as HTTP |

Tool, prompt, and resource names still come from each upstream’s MCP listings after connect; allowlists only **filter** what Sennit exposes.

## `roots`

Default **`{ mode: ignore }`**.

| Mode | Effect |
|------|--------|
| **`ignore`** | Upstream clients do not advertise **`roots`** to upstream servers. |
| **`forward`** | Host roots from **`mcp.server.listRoots()`** are reflected in upstream **`roots/list`** responses per policy. |
| **`intersect`** | Only roots whose **`uri`** starts with one of **`allowUriPrefixes`** (required, non-empty). |
| **`mapByUpstream`** | Optional per-**`serverKey`** list of **`fromPrefix` / `toPrefix`** rewrites applied after **`forward` / `intersect`**, before answering upstream **`roots/list`**. |

Maintainer contract (gitignored): **`private-docs/PASSTHROUGH-AND-MERGE.md`** — see [`private-docs/README.md`](../../private-docs/README.md).

## `sennit config print` / `plan`

Redacts **`servers.*.env`** (stdio), **`servers.*.headers`** (**`streamableHttp`** and **`sse`**), and **`roots.allowUriPrefixes`**. Does **not** redact **`args`**, **`cwd`**, **`url`**, or other fields.

**Changes:** schema in **`schema.ts`**, I/O in **`load.ts`**. Root [README.md](../../README.md) has the full operator story.
