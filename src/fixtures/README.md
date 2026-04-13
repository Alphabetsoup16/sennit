# `src/fixtures`

Test-only stdio MCP servers. Production code does not import them; integration tests run **`dist/fixtures/*.js`** after **`npm run build`**.

| File | Role |
|------|------|
| **`mock-upstream.ts`** | Tools **`mock.ping`**, **`mock.echo`**; prompt **`mock.greet`**; static resource **`mock.readme`**; resource template **`mock.dynamic`** (`file:///mock/dynamic/{name}`) |
