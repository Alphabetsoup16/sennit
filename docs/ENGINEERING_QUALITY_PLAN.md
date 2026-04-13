# Engineering quality plan

Principal-level backlog derived from a full codebase audit (correctness, robustness, DRY, performance, tests, validation, operations). **Execute one item at a time** in the order below unless a dependency note says otherwise.

**Status (2026-04):** Q-01–Q-13 are implemented in-tree (hub rollback on partial connect, schema key validation, `errorMessage` / `parseRequiredPositiveMs`, tests, `cliJsonOrHuman`, `proxyToolInputSchema`, docs). Re-run **`npm run validate`** after substantive changes.

## Goals

1. **No silent resource leaks** when upstream connection fails partway through startup.
2. **Fail fast with clear errors** for invalid config (especially rules that exist only at runtime today).
3. **One obvious way** to stringify errors and to tear down stdio upstreams.
4. **Tests that lock in** the above and cover optional APIs (`AbortSignal`, timeouts) where practical.
5. **Keep scope tight** per change: small PRs, each with a single primary outcome.

## Guiding principles

- Prefer **behavior-preserving refactors** unless the item explicitly changes user-visible semantics.
- Every P0/P1 item ships with **automated verification** (new or updated test, or reproducible CLI check documented in the item).
- **Config validation belongs in the schema** when the rule is static; runtime checks stay only for dynamic/SDK constraints.
- **Public API** (`src/index.ts`): add exports only when the helper is genuinely stable for consumers.

---

## Execution order

| ID | Priority | Title | Depends on |
|----|----------|--------|------------|
| Q-01 | P0 | Close hub on partial `connect` failure | — |
| Q-02 | P1 | Reject `__` in server keys at config parse | — |
| Q-03 | P1 | Shared `errorMessage(unknown)` helper | — |
| Q-04 | P1 | Regression test: partial connect cleanup | Q-01 |
| Q-05 | P2 | Namespace: negative tests for `parseNamespaced` | — |
| Q-06 | P2 | `executeBatchCall` respects `AbortSignal` (test) | Q-03 optional |
| Q-07 | P2 | `runDoctorInspect` timeout behavior (deterministic test) | — |
| Q-08 | P2 | `loadConfigFile` edge cases (extensionless / JSON path) | — |
| Q-09 | P2 | Dedupe stdio integration test harness with `test-utils` | — |
| Q-10 | P3 | Document `config print` redaction scope | — |
| Q-11 | P3 | Clarify `doctor inspect` timeout parsing (remove dead fallback) | — |
| Q-12 | P3 | Optional: small CLI human/JSON output helper to reduce drift | — |
| Q-13 | P3 | Optional: pass upstream `inputSchema` through proxy tools | — |

---

## Q-01 — Close hub on partial `connect` failure (P0)

**Problem:** `createAggregator` calls `await hub.connect(config)` before the `try` that closes the hub on MCP setup errors. If `connect` throws after some upstreams succeeded, those stdio processes may leak.

**Scope:** `src/aggregator/build-server.ts` (and verify no other call sites assume old behavior). Optionally `UpstreamHub.connect` rollback — closing the hub on failure is sufficient if `close()` is idempotent and clears the map.

**Acceptance criteria:**

- If `hub.connect` throws, **all** clients created before the throw are closed (verify via subprocess count or hub state if testable; at minimum, unit-test that `close` is invoked on the hub after a mocked partial failure if you inject a test double; otherwise integration test with two mock upstreams where the second fails).
- Successful path unchanged; existing tests still pass.

**Verification:** `npm run validate`.

**Notes:** This is the highest-impact correctness fix.

---

## Q-02 — Reject `__` in server keys at config parse (P1)

**Problem:** Keys containing `__` are invalid for namespacing but are only rejected when tools are registered.

**Scope:** `src/config/schema.ts` — refine `servers` keys (e.g. `z.record` key schema or `.superRefine` on the object). Align error messages with `namespacedToolName` wording.

**Acceptance criteria:**

- `sennitConfigSchema.parse` fails for `servers: { "a__b": { … } }` with an actionable message.
- Valid keys unchanged.

**Verification:** New unit test in `tests/config.test.ts` (or adjacent). `npm run validate`.

---

## Q-03 — Shared `errorMessage(unknown)` helper (P1)

**Problem:** The same `e instanceof Error ? e.message : String(e)` pattern appears in multiple modules.

**Scope:** Add `src/lib/error-message.ts` (or similar), replace usages in `batch.ts`, `load-config.ts`, `doctor-inspect.ts`, `inspect-upstreams.ts`, `setup.ts`. Export from `src/index.ts` only if you want it public; otherwise keep internal.

**Acceptance criteria:**

- No remaining copy-paste of that ternary for the same purpose in `src/` (grep-driven).
- Behavior unchanged for callers.

**Verification:** `npm run validate`.

---

## Q-04 — Regression test: partial connect cleanup (P1)

**Problem:** Without a test, Q-01 can regress.

**Scope:** Prefer a focused test on `UpstreamHub` or `createAggregator` with injected/mocked transports if the SDK allows; otherwise minimal integration test (two stdio entries, second command invalid) asserting **no orphan** behavior as far as the test harness can observe.

**Acceptance criteria:**

- Test fails on pre–Q-01 behavior if feasible; passes with Q-01.

**Verification:** `npm run validate`.

**Depends on:** Q-01 merged first (or implement test in same PR as Q-01).

---

## Q-05 — Namespace: negative tests for `parseNamespaced` (P2)

**Problem:** Only happy path and `__` in server key are covered.

**Scope:** `tests/namespace.test.ts` — cases for empty tool segment, missing delimiter, delimiter at start/end.

**Acceptance criteria:**

- Assertions on thrown message or error type as appropriate.

**Verification:** `npm run validate`.

---

## Q-06 — `executeBatchCall` + `AbortSignal` (P2)

**Problem:** `options.signal` exists but is untested.

**Scope:** `tests/batch.test.ts` — stub hub with delayed `callTool`; abort mid-flight; expect rejected or error-shaped results per actual SDK behavior (match implementation, don’t paper over).

**Acceptance criteria:**

- Documented expected behavior in test name/comments.
- Deterministic (no flaky timers beyond controlled delays).

**Verification:** `npm run validate`.

---

## Q-07 — `runDoctorInspect` timeout (P2)

**Problem:** Timeout path is subtle (`Promise.race`); no test.

**Scope:** Test with a **mocked** `UpstreamHub` or injectable dependency if you refactor for testability **only as much as needed**; alternatively accept an integration test with an upstream that sleeps longer than a short timeout (heavier).

**Acceptance criteria:**

- `fatalError` contains timeout wording when deadline exceeded.
- No flakiness in CI.

**Verification:** `npm run validate`.

---

## Q-08 — `loadConfigFile` edge cases (P2)

**Problem:** Extensionless path tries YAML then JSON; only YAML-on-disk is covered.

**Scope:** `tests/config.test.ts` — extensionless or `.json` files as documented in `load.ts`.

**Acceptance criteria:**

- Coverage matches comments in `parseRaw`.

**Verification:** `npm run validate`.

---

## Q-09 — Dedupe stdio integration test harness (P2)

**Problem:** `aggregator-stdio.test.ts` duplicates InMemory wiring that `tests/test-utils.ts` already provides.

**Scope:** Extend `withInMemoryAggregator` or add `withInMemoryAggregatorAndConfig` variant if needed; shrink `aggregator-stdio.test.ts` without losing assertion strength.

**Acceptance criteria:**

- Fewer lines, same coverage; `finally` cleanup remains guaranteed.

**Verification:** `npm run validate`.

---

## Q-10 — Document `config print` redaction scope (P3)

**Problem:** Operators may assume all secrets are redacted; only `servers.*.env` values are.

**Scope:** `src/config/README.md` or CLI help text for `config print` — one short paragraph.

**Acceptance criteria:**

- Clear statement: `args` / other fields are not redacted.

**Verification:** Doc-only review.

---

## Q-11 — `doctor inspect` timeout option cleanup (P3)

**Problem:** `parseTimeoutMs(opts.timeout, 30_000)` — Commander already supplies a default; inner fallback is redundant.

**Scope:** `src/cli/commands/doctor-inspect.ts` — simplify parsing; keep user-facing error messages.

**Acceptance criteria:**

- Same CLI behavior; simpler code path.

**Verification:** Existing CLI tests + `npm run validate`.

---

## Q-12 — Optional: CLI human/JSON helper (P3)

**Problem:** Parallel `if (json) printJson else stdout` blocks may drift over time.

**Scope:** Only if the team wants it — small internal helper in `src/cli/`, adopt incrementally in 1–2 commands first.

**Acceptance criteria:**

- No change in JSON shape or exit codes.

**Verification:** `npm run validate`.

---

## Q-13 — Optional: pass upstream `inputSchema` through proxy tools (P3)

**Problem:** Proxied tools use `looseArgs`; hosts lose strict schemas.

**Scope:** Investigate MCP SDK types for `listTools` → `registerTool` schema compatibility; may be non-trivial.

**Acceptance criteria:**

- Documented behavior when upstream schema cannot be represented.
- Tests with mock upstream returning a simple schema.

**Verification:** `npm run validate`.

---

## How to execute

1. Pick the next open item **by ID order** unless you are unblocking a dependency.
2. Implement in **one PR / one merge** per ID when possible.
3. Run **`npm run validate`** before merge.
4. After Q-01–Q-04, reassess whether Q-07 still needs a refactor for injectability.

---

## Related docs

- [EXTENDING.md](EXTENDING.md) — where to plug changes.
- [README.md](README.md) (this folder) — doc index.
