# `src/aggregator`

Host-facing **`McpServer`** plus **`UpstreamHub`**: one MCP **`Client`** per **`servers`** entry (**`stdio`** subprocess or **`streamableHttp`** remote). Implements **`sennit.meta`**, **`sennit.batch_call`**, namespaced **tools / prompts / resources**, sampling + elicitation passthrough, optional **lazy** + **idle** lifecycle, and optional **`dynamicToolList`** notifications to the host.

```mermaid
flowchart TB
  host[MCP_host]

  subgraph facade [Sennit_McpServer]
    mcp[McpServer_surface]
  end

  subgraph hub [UpstreamHub]
    c1[Client_A]
    c2[Client_B]
  end

  p1[Upstream_A]
  p2[Upstream_B]

  host <-->|stdio| mcp
  mcp --> c1
  mcp --> c2
  c1 <-->|MCP| p1
  c2 <-->|MCP| p2
```

## Files

| File | Role |
|------|------|
| **`build-server.ts`** | Re-exports **`createAggregator`** and related entrypoints |
| **`pipeline.ts`** | **`createMcpAndHub`**, **`registerAggregatorSurface`**, **`createAggregator`** wiring |
| **`upstream-probe.ts`**, **`doctor-inspect-types.ts`** | Shared connect + list probes (plan / doctor inspect) |
| **`upstream-hub.ts`** | **`StdioClientTransport`** or **`StreamableHTTPClientTransport`** + **`Client`**; **`ensureClient`** / **`touchActivity`**; bridge wiring |
| **`sampling-bridge.ts`** | **`makeUpstreamSamplingBridge(mcp)`** → **`mcp.server.createMessage`** |
| **`elicitation-bridge.ts`** | **`makeUpstreamElicitationBridge(mcp)`** → **`mcp.server.elicitInput`** |
| **`tool-list-changed-bridge.ts`** | **`sendToolListChanged`** when **`dynamicToolList`** |
| **`list-prompts.ts`**, **`prompt-args-from-listing.ts`** | Paginated **`prompts/list`** + Zod args for **`registerPrompt`** |
| **`roots-policy.ts`** | **`applyRootsPolicy`** — **`ignore`** / **`forward`** / **`intersect`** |
| **`roots-bridge.ts`** | Host **`listRoots`** → policy → upstream |
| **`batch.ts`** | **`executeBatchCall`** |
| **`proxy-input-schema.ts`** | Upstream JSON Schema → Zod for **`registerTool`**; loose fallback |
| **`list-resources.ts`** | Paginated **`resources/list`** |
| **`register-resources.ts`** | Merge static resources; **`urn:sennit:resource:v1:…`** façade + **`resources/read`** proxy |

## Registered surface

| Pattern | Source |
|---------|--------|
| **`sennit.meta`**, **`sennit.batch_call`** | Built-in |
| **`{serverKey}__{tool}`** | After **`servers.<key>.tools`** allowlist (if any) |
| **`{serverKey}__{prompt}`** | After **`servers.<key>.prompts`** allowlist (if any) |
| **`{serverKey}__{resource}`** | After **`servers.<key>.resources`** URI allowlist (if any) |

## Behavior notes

- **`tools/list`**, **`prompts/list`** (when the upstream advertises prompts), and **`resources/list`** (when supported) run **in parallel** across connected clients during catalog build.
- The merged catalog is **fixed for the Sennit session** after registration (no hot reload on the host). **`dynamicToolList`** only tells the host that upstream lists may have changed; reconnect to Sennit to pick up new registrations.
- **`inputSchema`:** common **`object`/`properties`** maps to strict Zod; otherwise a permissive object schema.

**New transport:** extend the discriminated **`servers`** entry in config, then branch in **`upstream-hub.ts`** ([docs/EXTENDING.md](../../docs/EXTENDING.md)).
