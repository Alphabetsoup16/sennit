# Gateway Deployment

Run Sennit as a Streamable HTTP gateway:

```bash
npx sennit serve --http-port 8787 --http-host 0.0.0.0
```

Recommended production flags:

- `--http-bearer <token>` for simple perimeter auth.
- `--http-allowed-host <host>` when binding to `0.0.0.0`.
- `--http-health-path` and `--http-ready-path` for probes.

Container workflow:

```bash
docker build -t sennit:local .
docker run --rm -p 8787:8787 -v "$(pwd)/sennit.config.yaml:/app/sennit.config.yaml:ro" sennit:local --config /app/sennit.config.yaml
```

Kubernetes notes:

- Liveness probe -> `/healthz`
- Readiness probe -> `/ready`
- Mount config + secret env vars for OAuth `clientSecretEnv`.
