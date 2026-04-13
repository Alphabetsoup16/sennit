# `src/config`

Zod schema + disk load (YAML / JSON).

| File | Role |
|------|------|
| **`schema.ts`** | **`sennitConfigSchema`**: **`version: 1`**, **`servers`**, **`roots`** |
| **`load.ts`** | **`loadConfigFile`**: read by extension, **`schema.parse`** |

## `roots`

Default **`{ mode: ignore }`**.

| Mode | Effect |
|------|--------|
| **`ignore`** | Upstream clients do not advertise **`roots`** to upstream servers. |
| **`forward`** | Pass host roots from **`mcp.server.listRoots()`** through to upstream **`roots/list`** responses. |
| **`intersect`** | Only roots whose **`uri`** starts with one of **`allowUriPrefixes`** (required, non-empty). |

Maintainer contract (gitignored): **`private-docs/PASSTHROUGH-AND-MERGE.md`** — see [`private-docs/README.md`](../../private-docs/README.md).

## `sennit config print`

Redacts **`servers.*.env`** and **`roots.allowUriPrefixes`**. Does **not** redact **`args`**, **`cwd`**, or other fields.

**Changes:** schema in **`schema.ts`**, I/O in **`load.ts`**. Config lists processes to run; tool names still come from each upstream’s **`tools/list`** after connect (root [README.md](../../README.md)).
