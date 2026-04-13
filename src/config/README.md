# `src/config`

Declarative **Sennit** config: validated with Zod, loaded from YAML or JSON on disk.

| File | Role |
|------|------|
| **`schema.ts`** | **`sennitConfigSchema`**: **`version: 1`**, **`servers`** (stdio), **`roots`** (passthrough policy) |
| **`load.ts`** | **`loadConfigFile(path)`** — read file, parse by extension, **`schema.parse`**

## `roots` (workspace / filesystem context)

Top-level **`roots`** (defaults to **`{ mode: ignore }`**):

- **`ignore`** — upstream MCP **`Client`s do not declare the `roots` capability**; upstream servers should not issue **`roots/list`** to Sennit (if they do, behavior is undefined per SDK).
- **`forward`** — forwards the **host’s** roots (from `mcp.server.listRoots()` on the Sennit server) unchanged after a successful read.
- **`intersect`** — only roots whose **`uri`** starts with one of **`allowUriPrefixes`** (non-empty array required).

See **[`docs/PASSTHROUGH-AND-MERGE.md`](../../docs/PASSTHROUGH-AND-MERGE.md)** for semantics and roadmap.

**`sennit config print` redaction:** values under **`servers.*.env`** and each **`roots.allowUriPrefixes`** entry are replaced with **`[redacted]`**. Other fields (including **`args`**, **`cwd`**) are not redacted—review before sharing.

**Extend:** add fields in **`schema.ts`**; keep file I/O in **`load.ts`**.

**Note:** the schema describes **which** upstreams to run and how; it does **not** imply automatic discovery of tools on the machine. Tool names still come from each upstream’s MCP **`tools/list`** after Sennit connects (see root [README.md](../../README.md)).
