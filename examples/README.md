# `examples/`

| File | Purpose |
|------|---------|
| **`sennit.config.example.yaml`** | Minimal **`servers.mock`** entry: **`node`** + **`dist/fixtures/mock-upstream.js`** |

Run **`npm run build`** first so the mock fixture exists under **`dist/`**.

```bash
npx sennit serve --config examples/sennit.config.example.yaml
```

Use this as a template: copy the file, replace **`command` / `args`** with your real upstream MCP servers, and optionally set **`tools`** per server to restrict which upstream tools appear as **`key__name`** on Sennit.
