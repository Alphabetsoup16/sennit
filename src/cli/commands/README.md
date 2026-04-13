# `src/cli/commands`

Each module exports **`register*(program)`** or **`register*(parent)`**; wire from [`register-commands.ts`](../register-commands.ts).

## Commands

| Command | Purpose | Flags |
|---------|---------|-------|
| **`version`** | Package + Node version | `--json` |
| **`serve`** | Aggregator MCP on stdio | `-c` |
| **`plan`** | Dry-run: redacted config, per-upstream lists, merged tools + resources | `-c`, `--json`, `--timeout` |
| **`doctor`** | Env, config validity, **`roots`** summary | `-c`, `--json` |
| **`doctor inspect`** | Live **`tools/list`** + **`resources/list`** per upstream | `-c`, `--json`, `--timeout` |
| **`config path`** | Default user **`config.yaml`** path | — |
| **`config validate`** | Validate file | **`-c`**, `--json` |
| **`config print`** | Effective config (redacted); **`--empty`** = schema default | `-c`, `--empty`, `--json` |
| **`config schema`** | JSON Schema (Zod → draft-7) | `--wrap` |
| **`setup`** | Create / import config | `--from`, `-o`, `-f` |
| **`onboard`** | Host **`mcp.json`** snippet | `-c` |
| **`completion`** | **`bash`** \| **`zsh`** \| **`fish`** script | `<shell>` |
| **`call`** | One **`tools/call`** via in-memory session | `<tool>`, `-c`, `--args`, `--json` |

**`sennit.meta`** is an MCP tool on the server, not a CLI command — use **`plan`** or **`config print`** for operator views.

**Positional options:** [`../index.ts`](../index.ts) enables Commander **`enablePositionalOptions()`** (flags after the subcommand name apply to that subcommand).

Shared strings: [`../cli-shared-options.ts`](../cli-shared-options.ts). JSON/human split: [`../print.ts`](../print.ts) **`cliJsonOrHuman`**.

## Conventions

| Topic | Rule |
|-------|------|
| **`doctor` vs `doctor inspect`** | Static vs live upstream probes |
| **`plan`** | Full merged view; **`doctor inspect`** = raw per-upstream only |
| **`config`** | Split subcommands, not one overloaded command |
| **Default path** | **`sennit config path`** only (not duplicated on **`setup`**) |

**New command:** add **`register*.ts`**, import in **`register-commands.ts`**, mirror **`-c` / `--json` / `--timeout`** from **`cli-shared-options.ts`** when it fits.
