# `examples/`

| File | Purpose |
|------|---------|
| **`sennit.config.example.yaml`** | Sample **`servers.mock`** → **`node dist/fixtures/mock-upstream.js`** |

```bash
npm run build
npx sennit serve -c examples/sennit.config.example.yaml
```

Copy and edit: set your real **`command`** / **`args`**, optional **`tools`** / **`resources`** per server.
