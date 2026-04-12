# `src/cli`

`npx sennit` entry: thin [`index.ts`](index.ts), wiring in [`register-commands.ts`](register-commands.ts).

| File / folder | Role |
|---------------|------|
| `index.ts` | `Command` root, `version`, `parseAsync` |
| `register-commands.ts` | Imports all `register*` from `commands/` |
| `commands/` | One module per subcommand — **[see `commands/README.md`](commands/README.md)** |
| `main-module.ts` | `isMainModule(import.meta.url)` for the entry file |
| `paths.ts` | Config path resolution |
| `load-config.ts` | `loadSennitConfig`, `tryLoadSennitConfig`, `EMPTY_CONFIG` |
| `print.ts` | `printJson` |

See **[`docs/EXTENDING.md`](../../docs/EXTENDING.md)** for how to add commands and transports.
