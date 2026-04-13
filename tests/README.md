# `tests/`

**Vitest.** `npm test` runs **`pretest` → `npm run build`** so **`dist/fixtures/mock-upstream.js`** exists for stdio integration tests.

## What each file proves

| File | Intent |
|------|--------|
| **`config.test.ts`** | Zod schema (incl. **`roots`**, invalid server keys); **`loadConfigFile`**; **`tryLoadSennitConfig`** |
| **`namespace.test.ts`** | `serverKey__toolName` rules and parsing |
| **`json-text.test.ts`** | Stable JSON serialization for tool payloads |
| **`batch.test.ts`** | **`executeBatchCall`**: ids, unknown server, concurrency, abort signal, isolated failures |
| **`paths.test.ts`** | **`resolveConfigPath`**: explicit, env, cwd vs per-user file |
| **`user-sennit-paths.test.ts`** | Default user config path with **`XDG_CONFIG_HOME`** |
| **`import-host-mcp.test.ts`** | **`mcp.json`** → stdio **`servers`**; skip rules |
| **`aggregator-inmemory.test.ts`** | No upstreams: **`sennit.meta`**, **`sennit.batch_call`** error shape |
| **`aggregator-stdio.test.ts`** | Real stdio mock upstream: proxy **`tools/call`**, forwarded **`inputSchema`** |
| **`aggregator-allowlist.test.ts`** | **`servers.*.tools`** allowlist hides non-listed upstream tools |
| **`mcp-helpers.ts`** | **`firstTextBlock`** for typed narrowing of tool results |
| **`test-utils.ts`** | **`withInMemoryAggregator`** — linked transports + guaranteed teardown |
| **`run-cli.ts`** | Spawn built **`dist/cli/index.js`** for black-box CLI tests |
| **`cli-fixtures.ts`** | Temp YAML configs + **`distMockUpstreamPath()`** for CLI integration tests |
| **`error-message.test.ts`**, **`parse-timeout-ms.test.ts`** | Small shared helpers |
| **`upstream-hub.test.ts`** | Partial **`connect`** rollback closes earlier stdio clients |
| **`proxy-input-schema.test.ts`** | JSON Schema → Zod mapping for proxied tools |
| **`cli-version.test.ts`**, **`cli-help.test.ts`** | **`version`**, **`help`** |
| **`cli-config-path.test.ts`** | **`config path`** |
| **`cli-config-print.test.ts`**, **`config-redact.test.ts`**, **`roots-policy.test.ts`** | **`config print`** (incl. **`--empty`**), redaction, **`applyRootsPolicy`** |
| **`cli-doctor-inspect.test.ts`**, **`inspect-upstreams.test.ts`** | **`doctor inspect`**, **`runDoctorInspect`** |
| **`plan-run.test.ts`**, **`cli-plan.test.ts`** | **`runPlan`**, **`sennit plan`** |

Run everything: **`npm run validate`** (lint + typecheck + test).
