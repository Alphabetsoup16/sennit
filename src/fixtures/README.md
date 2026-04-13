# `src/fixtures`

Test-only stdio MCP servers. Production code does not import them; integration tests run **`dist/fixtures/*.js`** after **`npm run build`**.

| File | Role |
|------|------|
| **`mock-upstream.ts`** | Tools **`mock.ping`**, **`mock.echo`**; prompt **`mock.greet`**; resource **`mock.readme`** at **`file:///mock/readme.md`** |
