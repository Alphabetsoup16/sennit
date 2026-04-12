# Extending Sennit

Where to plug in new behavior so the codebase stays predictable.

## Add a CLI subcommand

1. Create [`src/cli/commands/<name>.ts`](../src/cli/commands/) with `export function register<Name>(program: Command): void` (see existing files).
2. Import and call it from [`src/cli/register-commands.ts`](../src/cli/register-commands.ts).
3. Add a short note in [`src/cli/README.md`](../src/cli/README.md) if the command is non-obvious.
4. Add tests under [`tests/`](../tests/) if the command has logic beyond delegating to the library.

## Add config fields

1. Update [`src/config/schema.ts`](../src/config/schema.ts) (Zod).
2. If parsing rules change, update [`src/config/load.ts`](../src/config/load.ts).
3. Document in [`src/config/README.md`](../src/config/README.md) and sample YAML in [`examples/`](../examples/).

## Add an upstream transport (e.g. HTTP)

Today only **stdio** exists in [`src/aggregator/upstream-hub.ts`](../src/aggregator/upstream-hub.ts). A second transport usually means:

1. Extend the server entry in `schema.ts` with a discriminated union (`transport: "stdio" | "http"` + fields per variant).
2. Branch in `UpstreamHub.connect()` to construct `Client` + the right transport.
3. Add tests with a mock HTTP server or SDK test utilities.

## Add a built-in MCP tool (on the aggregator)

Edit [`src/aggregator/build-server.ts`](../src/aggregator/build-server.ts): call `mcp.registerTool(...)` **before** or **after** the upstream proxy loop as appropriate, and avoid colliding with `serverKey__` names unless intentional.

## Add library exports

Re-export from [`src/index.ts`](../src/index.ts) only for stable public API; keep internals importable via deep paths until you are ready to commit to semver for them.

## Docs and tests

| Change type | Typical test location |
|-------------|------------------------|
| Pure helpers | `tests/*.test.ts` next to feature name |
| Aggregator / MCP | `tests/aggregator-*.test.ts` + helpers in [`tests/test-utils.ts`](../tests/test-utils.ts) |

Run **`npm run validate`** before opening a PR.
