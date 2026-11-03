# Getting started

Prerequisites: Docker, [mise](https://mise.jdx.dev) (installs Node and Bun).

```bash
mise run up               # collector, VictoriaMetrics, Grafana
mise run status           # health of the stack
mise run plugin:install   # install the OpenCode plugin
```

Then start a new opencode session and use it. Grafana: http://127.0.0.1:3000 (no login, localhost only). Raw query check:

```bash
curl -s 'http://127.0.0.1:8428/api/v1/query?query=sum+by(gen_ai_request_model)(gen_ai_client_token_usage_sum)'
```

Other commands: `mise run logs`, `mise run down` (keeps data), `mise run reset` (deletes data).

## Connecting another OTel source (e.g. GitHub Copilot)

Point its OTLP endpoint at `http://localhost:4318` (http/json or http/protobuf) or `localhost:4317` (grpc). Document normalisation rules per source in `docs/sources/<tool>.md` (example: [sources/github-copilot.md](sources/github-copilot.md)).

## Troubleshooting

- No data right after sending: VictoriaMetrics is configured with a 1 s query latency offset (ADR 0013); the collector batches for 2 s.
- Plugin not exporting: check `~/.local/share/opencode/log/ai-monitoring.log` (OpenCode 2) or `opencode.log` (OpenCode 1) for `ai-monitoring`.

## Next steps

- Open the dashboard and see [dashboard.md](dashboard.md); prices and credits come from the `pricing-sync` service ([pricing.md](pricing.md)).
- Connect GitHub Copilot: [sources/github-copilot.md](sources/github-copilot.md).
- Available metrics and ideas for extensions: [metrics-catalog.md](metrics-catalog.md).
