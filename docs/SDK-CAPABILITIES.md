# SDK Capability Audit

This repository targets `@modelcontextprotocol/sdk` `^1.29.0`.

Dynamic registration audit result:

- `McpServer.registerTool(...)` returns a handle with `remove()`, `disable()`, `enable()`.
- `McpServer.registerPrompt(...)` returns a handle with `remove()`, `disable()`, `enable()`.
- `McpServer.registerResource(...)` returns a handle with `remove()`, `disable()`, `enable()`.

This means Sennit can build true dynamic catalog updates (add/remove proxied registrations) without requiring an upstream SDK change for basic registry mutation support.

Regression guard:

- `tests/sdk-mcp-capabilities.test.ts` verifies these handle APIs exist.
