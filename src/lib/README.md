# `src/lib`

Pure helpers (no MCP transport).

| File | Role |
|------|------|
| `namespace.ts` | `serverKey__toolName` / parse (no `__` in server key) |
| `version.ts` | Version from repo `package.json` |
| `json-text.ts` | `jsonText()` for stable 2-space JSON |

```mermaid
flowchart LR
  up[upstream tool search] --> ns[mydocs__search]
```
