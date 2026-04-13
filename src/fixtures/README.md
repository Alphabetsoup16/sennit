# `src/fixtures`

Test-only stdio MCP servers. Production code does not import them; tests run **`dist/fixtures/*.js`** after **`npm run build`**.

| File | Role |
|------|------|
| **`mock-upstream.ts`** | Tools **`mock.ping`**, **`mock.echo`**; resource **`mock.readme`** at **`file:///mock/readme.md`** |
