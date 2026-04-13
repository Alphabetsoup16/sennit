# `examples/`

| File | Purpose |
|------|---------|
| **`sennit.config.example.yaml`** | Sample **`servers.mock`** → **`node dist/fixtures/mock-upstream.js`** (stdio) |

```bash
npm run build
npx sennit serve -c examples/sennit.config.example.yaml
```

Copy and edit for your environment: real **`command`** / **`args`** or a **`streamableHttp`** **`url`**, optional **`tools`**, **`resources`**, and **`prompts`** allowlists per server. Root [README.md](../README.md) documents transports and flags.
