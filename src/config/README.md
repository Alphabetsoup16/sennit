# `src/config`

| File | Role |
|------|------|
| `schema.ts` | Zod: `version: 1`, `servers` (stdio only) |
| `load.ts` | `loadConfigFile` — YAML or JSON |

**Extend:** new fields in `schema.ts`; I/O stays in `load.ts`.
