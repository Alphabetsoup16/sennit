# `src/cli/commands`

Each file exports **`register*(program)`** (or **`register*(parent)`** for nested groups), wired from [`register-commands.ts`](../register-commands.ts).

## Command inventory

| Command | Role | Typical flags |
|---------|------|-----------------|
| **`version`** | Package + Node version | `--json` |
| **`serve`** | Run aggregator MCP server on stdio | `-c` |
| **`plan`** | Dry-run: redacted config + upstream **`tools/list`** + merged catalog | `-c`, `--json`, `--timeout` |
| **`doctor`** | Static env + config validity + **`roots`** summary | `-c`, `--json` |
| **`doctor inspect`** | Live per-upstream **`tools/list`** | `-c`, `--json`, `--timeout` |
| **`config path`** | Print default user **`config.yaml`** path | — |
| **`config validate`** | Validate an explicit config file | **`-c` (required)**, `--json` |
| **`config print`** | Effective config (redacted); empty template: **`--empty`** | `-c`, **`--empty`**, `--json` |
| **`setup`** | Create / import user config | `--from`, `-o`, `-f` |
| **`onboard`** | Paste-ready host **`mcp.json`** snippet | `-c` |

The MCP tool **`sennit.meta`** (on the aggregator) is separate from the CLI — use **`sennit plan`** or **`config print`** for operator views.

Root: **`help [command]`** ([`index.ts`](../index.ts)), **`-V` / `--version`**, **`enablePositionalOptions()`** so flags after subcommands bind correctly (e.g. **`doctor inspect -c file.yaml`**).

Shared option strings: [`cli-shared-options.ts`](../cli-shared-options.ts).

## Design notes

| Topic | Choice |
|-------|--------|
| **`doctor` vs `doctor inspect`** | Subcommand for clarity and completion. |
| **`plan` vs `doctor inspect`** | Top-level **`plan`** for full dry-run (merged catalog). |
| **`config` subcommands** | **`path`**, **`validate`**, **`print`** instead of one overloaded command. |
| **Default config path** | Only **`sennit config path`** — no duplicate flag on **`setup`**. |
| **Empty schema JSON** | **`sennit config print --empty --json`** (wrapped payload with **`schemaVersion`**). |

**`--json`:** use **`cliJsonOrHuman`** from [`print.ts`](../print.ts) where applicable.

**Add a command:** new file + **`register-commands`** import; reuse **`cli-shared-options.ts`** for **`-c` / `--json` / `--timeout`** when it fits.
