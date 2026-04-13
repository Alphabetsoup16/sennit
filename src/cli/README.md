# `src/cli`

Entry for **`npx sennit`** (npm package **`sennit`**): a small root ([`index.ts`](index.ts)) plus command registration ([`register-commands.ts`](register-commands.ts)).

## Layout

| File / folder | Role |
|---------------|------|
| **`index.ts`** | Root `Command`, `--version`, `parseAsync` |
| **`register-commands.ts`** | Imports **`register*`** from **`commands/`** |
| **`commands/`** | One module per subcommand — [commands/README.md](commands/README.md) |
| **`user-sennit-paths.ts`** | Default per-user **`config.yaml`** directory (XDG / macOS / Windows) |
| **`import-host-mcp.ts`** | Parse Cursor-style **`mcp.json`** → Sennit **`servers`** (stdio only) |
| **`config-redact.ts`** | Clone config and redact **`servers.*.env`** for **`config print`** |
| **`inspect-upstreams.ts`** | **`runDoctorInspect`** — shared logic for **`doctor inspect`** |
| **`plan-run.ts`** | **`runPlan`** / **`planOverallOk`** — orchestration for **`sennit plan`** |
| **`parse-timeout-ms.ts`** | **`parsePositiveTimeoutMs`**, **`parseRequiredPositiveMs`**, default timeout constant |
| **`main-module.ts`** | **`isMainModule(import.meta.url)`** so the CLI file can be imported without side effects |
| **`cli-shared-options.ts`** | Shared **`-c` / `--json` / `--timeout`** flags and help text for Commander |
| **`paths.ts`** | Resolve config path: flag → env → default filenames |
| **`load-config.ts`** | **`loadSennitConfig`**, **`tryLoadSennitConfig`**, **`EMPTY_CONFIG`** |
| **`print.ts`** | **`printJson`**, **`cliJsonOrHuman`** for CLI output |

Config only **loads** YAML/JSON from disk; it does **not** discover MCP servers automatically—you list each upstream under **`servers`**. See the root [README.md](../../README.md) section on discovery.

**Extend:** [docs/EXTENDING.md](../../docs/EXTENDING.md).
