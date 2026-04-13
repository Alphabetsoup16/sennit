# `src/lib`

Pure helpers — no transports, no subprocesses.

| File | Role |
|------|------|
| **`namespace.ts`** | **`TOOL_NAMESPACE_SEPARATOR`**, **`namespacedToolName`**, **`parseNamespaced`**, **`takeUniqueMergedToolId`** |
| **`resource-facade.ts`** | Opaque **`urn:sennit:resource:v1:…`** encode/decode |
| **`limits.ts`** | Shared caps (e.g. batch size) |
| **`version.ts`** | Version string from **`package.json`** |
| **`json-text.ts`** | **`jsonText()`** — stable 2-space JSON for MCP **`text`** payloads |
| **`error-message.ts`** | **`errorMessage(unknown)`** for logs and CLI |

```mermaid
flowchart LR
  subgraph keys [Inputs]
    sk[serverKey]
    tn[upstream_tool_name]
  end

  subgraph out [Facade_name]
    ns["serverKey__toolName"]
  end

  sk --> ns
  tn --> ns
```

Namespacing is for the merged catalog only; which tools exist still comes from each upstream’s **`tools/list`**.
