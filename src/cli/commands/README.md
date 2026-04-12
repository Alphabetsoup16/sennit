# `src/cli/commands`

One file per **top-level or nested** CLI command; each exports `register*(program)`.

| File | Command |
|------|---------|
| `serve.ts` | `sennit serve` |
| `doctor.ts` | `sennit doctor` |
| `config-validate.ts` | `sennit config validate` (registered on `config` parent in `register-commands.ts`) |
| `onboard.ts` | `sennit onboard` |
| `meta.ts` | `sennit meta` |

**Add a command:** copy a small existing file, wire it in [`register-commands.ts`](../register-commands.ts).
