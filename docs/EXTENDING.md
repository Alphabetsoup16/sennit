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
3. Document in [`src/config/README.md`](../src/config/README.md) and sample YAML in [`examples/`](../examples/).

## Add an upstream transport (e.g. HTTP)

Today only **stdio** exists in [`src/aggregator/upstream-hub.ts`](../src/aggregator/upstream-hub.ts). A second transport usually means:

1. Extend the server entry in `schema.ts` with a discriminated union (`transport: "stdio" | "http"` + fields per variant).
2. Branch in `UpstreamHub.connect()` to construct `Client` + the right transport.
3. Add tests with a mock HTTP server or SDK test utilities.

## Sampling passthrough (upstream → host)

Sennit forwards upstream [`sampling/createMessage`](https://modelcontextprotocol.io/specification/draft/client/sampling) to the **host** MCP client using the same bridge pattern as roots:

- [`src/aggregator/sampling-bridge.ts`](../src/aggregator/sampling-bridge.ts) — `makeUpstreamSamplingBridge(mcp)` → `mcp.server.createMessage(params)`
- [`src/aggregator/upstream-hub.ts`](../src/aggregator/upstream-hub.ts) — upstream `Client` instances declare `sampling.tools` and register `CreateMessageRequestSchema` after connect

The **host** must declare client `capabilities.sampling` (and `sampling.tools` if upstreams use tool loops). Doctor-only probes use `new UpstreamHub()` with no bridge so they do not pretend to support sampling.

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
