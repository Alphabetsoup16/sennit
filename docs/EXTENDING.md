# Extending Sennit

Where to plug in new behavior so the codebase stays predictable.

For **multi-capability passthrough** (tools, resources, prompts, **roots**, notifications) and **merge policy** expectations, maintainers keep the living contract in **`private-docs/PASSTHROUGH-AND-MERGE.md`** (gitignored — see [`private-docs/README.md`](../private-docs/README.md)).

## Add a CLI subcommand

1. Create [`src/cli/commands/<name>.ts`](../src/cli/commands/) with `export function register<Name>(program: Command): void` (see existing files).
2. Import and call it from [`src/cli/register-commands.ts`](../src/cli/register-commands.ts).
3. Add a short note in [`src/cli/README.md`](../src/cli/README.md) if the command is non-obvious.
4. Add tests under [`tests/`](../tests/) if the command has logic beyond delegating to the library.

**Reference:** [`setup`](../src/cli/commands/setup.ts) writes the per-user config and delegates import rules to [`import-host-mcp.ts`](../src/cli/import-host-mcp.ts); path resolution lives in [`paths.ts`](../src/cli/paths.ts) + [`user-sennit-paths.ts`](../src/cli/user-sennit-paths.ts).

## Add config fields

1. Update [`src/config/schema.ts`](../src/config/schema.ts) (Zod).
2. If parsing rules change, update [`src/config/load.ts`](../src/config/load.ts).
3. Document in [`src/config/README.md`](../src/config/README.md) and update the root sample [`sennit.config.example.yaml`](../sennit.config.example.yaml) when the shape changes.

## Add or change an upstream transport

**stdio**, **streamableHttp**, and legacy **sse** are implemented in [`src/aggregator/upstream-hub.ts`](../src/aggregator/upstream-hub.ts). Remote URLs must use **`http:`** or **`https:`** (`assertHttpOrHttpsUrl`). Optional **`httpRequestTimeoutMs`** wraps **`fetch`** via [`fetch-timeout.ts`](../src/lib/fetch-timeout.ts). A new variant usually means:

1. Extend the server entry in [`schema.ts`](../src/config/schema.ts) (`discriminatedUnion`).
2. Branch in `UpstreamHub.spawnClient` to construct `Client` + the right transport.
3. Add tests (mock server or SDK utilities).

## Sampling / elicitation passthrough (upstream → host)

Sennit forwards upstream [`sampling/createMessage`](https://modelcontextprotocol.io/specification/draft/client/sampling) and [`elicitation/create`](https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation) to the **host** MCP client using the same bridge pattern as roots:

- [`src/aggregator/sampling-bridge.ts`](../src/aggregator/sampling-bridge.ts) — `mcp.server.createMessage`
- [`src/aggregator/elicitation-bridge.ts`](../src/aggregator/elicitation-bridge.ts) — `mcp.server.elicitInput`
- [`src/aggregator/upstream-hub.ts`](../src/aggregator/upstream-hub.ts) — capability declarations + `setRequestHandler` after transport connect

The **host** must declare the matching client capabilities. Doctor-only probes use `new UpstreamHub()` with no bridges.

## Tool call timeouts (proxied + batch)

Per-server **`toolCallTimeoutMs`** wraps upstream **`tools/call`** with [`withAbortTimeout`](../src/lib/with-timeout.ts): the MCP client **`AbortSignal`** triggers SDK cancellation (`notifications/cancelled`), not only a local promise race. [`pipeline.ts`](../src/aggregator/pipeline.ts) uses it for namespaced tools; [`batch.ts`](../src/aggregator/batch.ts) uses the same helper and composes with optional **`executeBatchCall` `signal`**.

## Lazy upstreams, idle disconnect, HTTP

- **`servers.*.lazy`**: skipped in `connect()`; [`ensureClient`](../src/aggregator/upstream-hub.ts) connects on probe or first proxied use.
- **`servers.*.idleTimeoutMs`**: [`touchActivity`](../src/aggregator/upstream-hub.ts) arms a timer after successful proxied calls; idle closes the client (catalog unchanged until the host reconnects to Sennit).
- **`transport: streamableHttp`**: [`StreamableHTTPClientTransport`](../src/aggregator/upstream-hub.ts) from the SDK; optional **`headers`**, **`streamableHttpReconnection`**, **`httpRequestTimeoutMs`**.
- **`transport: sse`**: deprecated SDK [`SSEClientTransport`](../src/aggregator/upstream-hub.ts) for legacy servers.

## Dynamic list-changed hints (tools / resources / prompts)

When **`dynamicToolList`**, **`dynamicResourceList`**, or **`dynamicPromptList`** is true, upstream MCP clients subscribe to the matching list-changed notifications (if advertised) and call **`sendToolListChanged`**, **`sendResourceListChanged`**, or **`sendPromptListChanged`** on the host via [`host-list-changed-bridge.ts`](../src/aggregator/host-list-changed-bridge.ts). Merged registrations are still fixed at aggregator startup until the host reconnects.

## Structured logs

Set **`SENNIT_LOG=json`** for one JSON line per proxied tool call ([`src/lib/sennit-json-log.ts`](../src/lib/sennit-json-log.ts)).

## Add a built-in MCP tool (on the aggregator)

Edit [`src/aggregator/pipeline.ts`](../src/aggregator/pipeline.ts) (registered from [`build-server.ts`](../src/aggregator/build-server.ts) re-exports): add `mcp.registerTool(...)` in **`registerAggregatorSurface`** (or earlier in the pipeline) so it does not collide with `serverKey__` proxies unless intentional.

## Add library exports

Re-export from [`src/index.ts`](../src/index.ts) only for stable public API; keep internals importable via deep paths until you are ready to commit to semver for them.

## Docs and tests

| Change type | Typical test location |
|-------------|------------------------|
| Pure helpers | `tests/*.test.ts` next to feature name |
| Aggregator / MCP | `tests/aggregator-*.test.ts` + helpers in [`tests/test-utils.ts`](../tests/test-utils.ts) |

Run **`npm run validate`** before opening a PR.

## CLI parsing note

[`src/cli/index.ts`](../src/cli/index.ts) enables **`enablePositionalOptions()`** so options that appear **after** a subcommand name apply to that subcommand (e.g. **`doctor inspect -c path`**). Keep this in mind when adding duplicate **`--config`** / short flags on both a parent and a child command.
