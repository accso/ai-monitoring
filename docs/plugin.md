# OpenCode plugin

Source: `plugins/opencode` (TypeScript; one bundle serves **OpenCode 1 and 2**, also when both are installed). ADR 0018.

## Install

```bash
mise run up               # stack (needed for integration tests and data)
mise run plugin:install   # typecheck, tests, esbuild bundle, verify, copy to ~/.config/opencode/plugins/ai-monitoring.js
mise run plugin:uninstall
```

`scripts/install-plugin.sh --help` shows options (`--target`, `--skip-tests`, `--dry-run`). OpenCode 1 picks it up on the next session; OpenCode 2 reloads plugins on change (`opencode plugin list` to confirm, `opencode service restart` if stuck). Release process: skill `plugin-release` and [releasing.md](releasing.md).

## Configuration

Environment variables win over plugin options (set via `plugins: [{ "package": "...", "options": {...} }]` in opencode.json), which win over defaults.

| Env | Default | Meaning |
|---|---|---|
| `AI_MONITORING_TRANSPORT` | `otlp` | `otlp` or `direct` |
| `AI_MONITORING_OTLP_ENDPOINT` | `http://127.0.0.1:4318` | collector base URL |
| `AI_MONITORING_VM_URL` | `http://127.0.0.1:8428` | VictoriaMetrics (direct mode) |
| `AI_MONITORING_FLUSH_MS` | `5000` | flush interval |
| `AI_MONITORING_SERVICE_NAME` | `opencode` | `service.name` |
| `AI_MONITORING_PROJECT` | auto | project label (ADR 0008) |

Note for ACP clients (JetBrains): the env must be visible to the `opencode acp` process.

## Behaviour to know

- Sends only changed series; cumulative values, so a failed flush is retried without loss.
- If the stack is down, one warning is logged: OpenCode 1 writes it to the opencode log (`~/.local/share/opencode/log/opencode.log`), OpenCode 2 (no plugin logger, console output is not forwarded) to `~/.local/share/opencode/log/ai-monitoring.log` until the next success; usage keeps accumulating in memory and is delivered when the stack returns (not across opencode restarts).
- Default export `{ id: "ai-monitoring", setup, server }`: OpenCode 2 uses `setup(ctx)` (returns a flushing cleanup), OpenCode 1 uses `server()` (flushing `dispose`). Each call owns its tracker/exporter (ADR 0009 superseded). Do not keep a second copy (e.g. a `plugins/ai-monitoring/` directory) next to the bundle: it would load twice and double count.
- OpenCode 2: counts per-step usage (`session.step.ended`/`failed`) attributed to the model from `session.step.started`, plus `session.compaction.ended`. Title-generation usage is not exposed in public events and is not counted.
- Supported: OpenCode 1 >= 1.19, OpenCode 2. Verified live on 1.19.4 and 2.2.0 (token sums match OpenCode exactly). Compaction usage verified live on V2 (matches the compaction message exactly). After changes, send a prompt and compare VictoriaMetrics with OpenCode's session totals.

## Tests

`mise run plugin:test` — typecheck, unit tests (Vitest), and integration tests against the live stack (skipped automatically if the stack is down).
