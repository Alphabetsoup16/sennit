# `src/`

Sennit package source.

```mermaid
flowchart LR
  cli[cli] --> agg[aggregator]
  idx[index.ts] --> agg
  agg --> hub[upstream-hub]
  agg --> batch[batch]
  cli --> cfg[config/load]
```

| Directory | Role |
|-----------|------|
| `aggregator/` | `createAggregator`, MCP server |
| `cli/` | `sennit` commands |
| `config/` | Schema + YAML/JSON load |
| `lib/` | `namespace`, `version`, `jsonText` |
| `fixtures/` | Test MCP subprocess |

Public API: `import { createAggregator, … } from "mcp-parallel"` (published build).  
Extensions: [`docs/EXTENDING.md`](../docs/EXTENDING.md).
