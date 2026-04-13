# `src/fixtures`

Test-only MCP **stdio** servers. They are **not** imported from production **`aggregator`** or **`cli`** code; tests spawn **`dist/fixtures/*.js`** after **`npm run build`**.

| File | Role |
|------|------|
| **`mock-upstream.ts`** | Registers **`mock.ping`** (returns `pong`) and **`mock.echo`** (echoes **`msg`**) for integration tests |
