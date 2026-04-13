# `tests/`

**Vitest.** **`npm test`** runs **`pretest`** → **`npm run build`** so **`dist/fixtures/mock-upstream.js`** exists for stdio tests.

**Full check:** **`npm run validate`** (lint + typecheck + test).

## By area

| Area | Files |
|------|-------|
| **Config / schema** | **`config.test.ts`**, **`config-redact.test.ts`**, **`roots-policy.test.ts`** |
| **Namespace / JSON** | **`namespace.test.ts`**, **`json-text.test.ts`**, **`resource-facade.test.ts`** |
| **Aggregator** | **`aggregator-inmemory.test.ts`**, **`aggregator-stdio.test.ts`**, **`aggregator-allowlist.test.ts`**, **`aggregator-multi-upstream.test.ts`** (two live stdio + **`batch_call`**), **`aggregator-resources-allowlist.test.ts`**, **`upstream-hub.test.ts`**, **`upstream-probe.test.ts`**, **`batch.test.ts`**, **`proxy-input-schema.test.ts`** |
| **CLI** | **`run-cli.ts`**, **`cli-fixtures.ts`**, **`cli-*.test.ts`** (help, version, plan, doctor, config, call, completion, schema, …) |
| **Shared logic** | **`inspect-upstreams.test.ts`**, **`plan-run.test.ts`**, **`paths.test.ts`**, **`user-sennit-paths.test.ts`**, **`import-host-mcp.test.ts`**, **`error-message.test.ts`**, **`parse-timeout-ms.test.ts`** |
| **Harness** | **`test-utils.ts`** (`withInMemoryAggregator`), **`mcp-helpers.ts`** (`firstTextBlock`) |
