# `tests/`

`npm test` runs **`pretest` → `npm run build`** so `dist/fixtures/mock-upstream.js` exists.

| File | Covers |
|------|--------|
| `config.test.ts` | Schema + YAML load |
| `namespace.test.ts` | Namespacing rules |
| `json-text.test.ts` | `jsonText` |
| `aggregator-inmemory.test.ts` | Meta + `batch_call` |
| `aggregator-stdio.test.ts` | Stdio upstream + proxy |
| `mcp-helpers.ts` | `firstTextBlock` for tool results |
| `test-utils.ts` | `withInMemoryAggregator` |
