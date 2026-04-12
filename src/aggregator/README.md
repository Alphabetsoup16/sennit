# `src/aggregator`

Sennit **McpServer**: stdio clients per upstream, merged `tools/list`, `tools/call` routing.

```mermaid
flowchart TB
  host[Host]
  sennit[sennit McpServer]
  hub[UpstreamHub]
  host <-->|stdio| sennit
  sennit --> hub
  hub --> u1[stdio server]
  hub --> u2[stdio server]
```

| File | Role |
|------|------|
| `upstream-hub.ts` | `Client` + `StdioClientTransport` per server |
| `batch.ts` | Parallel `callTool` for `sennit.batch_call` |
| `build-server.ts` | `createAggregator()` |

Built-ins: `sennit.meta`, `sennit.batch_call`, `{serverKey}__{tool}`.

**Extend:** e.g. HTTP transport in `upstream-hub.ts`. **Avoid:** registering tools after `connect` without list-changed handling.
