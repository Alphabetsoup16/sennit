# `src/lib`

Pure helpers — no transports, no subprocesses. Used by the aggregator and CLI.

| File | Role |
|------|------|
| **`namespace.ts`** | **`TOOL_NAMESPACE_SEPARATOR`**, **`namespacedToolName`**, **`parseNamespaced`**, **`takeUniqueMergedToolId`** |
| **`resource-facade.ts`** | Opaque **`urn:sennit:resource:v1:…`** encode/decode |
| **`limits.ts`** | Shared caps (e.g. batch size) |
| **`version.ts`** | Version string from **`package.json`** |
| **`json-text.ts`** | **`jsonText()`** — stable 2-space JSON for MCP **`text`** payloads |
| **`error-message.ts`** | **`errorMessage(unknown)`** for logs and CLI |
| **`truncate-tool-description.ts`** | **`truncateForToolList`** when **`toolsListDescriptionMaxChars`** is set |
| **`sennit-json-log.ts`** | One JSON line per proxied tool result when **`SENNIT_LOG=json`** |

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

Namespacing applies to the merged catalog; which tools exist still comes from each upstream’s **`tools/list`**.
