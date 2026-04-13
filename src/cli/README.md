# `src/cli`

**`npx sennit`**: [`index.ts`](index.ts) (root **`Command`**, **`parseAsync`**) + [`register-commands.ts`](register-commands.ts). Subcommands: [`commands/README.md`](commands/README.md).

## Files

| Path | Role |
|------|------|
| **`index.ts`** | Root **`Command`**, **`--version`**, **`enablePositionalOptions()`**, **`parseAsync`** |
| **`register-commands.ts`** | Wires **`register*`** from **`commands/`** |
| **`commands/`** | One module per subcommand |
| **`paths.ts`** | Config path: flag → **`SENNIT_CONFIG`** → cwd files → user default |
| **`user-sennit-paths.ts`** | Per-user **`config.yaml`** dir (XDG / macOS / Windows) |
| **`load-config.ts`** | **`loadSennitConfig`**, **`tryLoadSennitConfig`**, **`EMPTY_CONFIG`** |
| **`import-host-mcp.ts`** | Cursor-style **`mcp.json`** → **`servers`** (stdio) |
| **`config-redact.ts`** | **`redactSennitConfig`**: **`servers.*.env`**, **`servers.*.headers`**, **`roots.allowUriPrefixes`** |
| **`inspect-upstreams.ts`** | **`runDoctorInspect`** |
| **`plan-run.ts`** | **`runPlan`**, **`planOverallOk`** |
| **`format-inspect-upstreams.ts`** | Human lines for plan / doctor inspect upstream sections |
| **`parse-timeout-ms.ts`** | Timeout parsing + defaults |
| **`cli-timeout.ts`** | Doctor inspect timeout parsing |
| **`cli-shared-options.ts`** | Shared **`-c` / `--json` / `--timeout`** help text |
| **`print.ts`** | **`printJson`**, **`cliJsonOrHuman`** |
| **`main-module.ts`** | **`isMainModule(import.meta.url)`** for test imports |

**`enablePositionalOptions()`** so **`doctor inspect -c path`** binds **`-c`** to **`inspect`**.

Config load does not discover servers — only **`servers`** in YAML/JSON. Root [README.md](../../README.md) covers operator usage.

**Extend:** [docs/EXTENDING.md](../../docs/EXTENDING.md).
