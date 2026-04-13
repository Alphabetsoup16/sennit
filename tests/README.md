# `tests/`

**Vitest.** **`npm test`** runs **`pretest`** → **`npm run build`** so **`dist/fixtures/mock-upstream.js`** exists for stdio integration tests.

**Full gate:** **`npm run validate`** (lint + typecheck + test).

## By area

| Area | Files |
|------|-------|
| **Config / schema** | **`config.test.ts`**, **`config-redact.test.ts`**, **`roots-policy.test.ts`** |
| **Namespace / JSON / lib** | **`namespace.test.ts`**, **`json-text.test.ts`**, **`resource-facade.test.ts`**, **`truncate-tool-description.test.ts`**, **`paginate-next-cursor.test.ts`**, **`with-timeout.test.ts`**, **`error-message.test.ts`**, **`fetch-timeout.test.ts`** |
| **Aggregator** | **`aggregator-inmemory.test.ts`**, **`aggregator-stdio.test.ts`**, **`aggregator-allowlist.test.ts`**, **`aggregator-multi-upstream.test.ts`**, **`aggregator-resources-allowlist.test.ts`**, **`aggregator-partial-probe.test.ts`**, **`aggregator-roots-stdio.test.ts`**, **`upstream-hub.test.ts`**, **`upstream-probe.test.ts`**, **`batch.test.ts`**, **`proxy-input-schema.test.ts`**, **`roots-bridge.test.ts`**, **`sampling-bridge.test.ts`**, **`elicitation-bridge.test.ts`** |
| **CLI** | **`run-cli.ts`**, **`cli-fixtures.ts`**, **`cli-*.test.ts`** (help, version, plan, doctor, doctor inspect, config, call, completion, schema, …), **`cli-timeout.test.ts`** |
| **Shared CLI / paths** | **`inspect-upstreams.test.ts`**, **`format-inspect-upstreams.test.ts`**, **`plan-run.test.ts`**, **`paths.test.ts`**, **`user-sennit-paths.test.ts`**, **`import-host-mcp.test.ts`**, **`parse-timeout-ms.test.ts`** |
| **Harness** | **`test-utils.ts`** (`withInMemoryAggregator`), **`mcp-helpers.ts`** (`firstTextBlock`) |
