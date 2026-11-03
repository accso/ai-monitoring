# Architecture

Decisions and their rationale live in [docs/adr](adr/README.md). This document describes the resulting structure.

## Overview

```
OpenCode plugin ──OTLP/HTTP──▶ OTel Collector ──OTLP──▶ VictoriaMetrics ◀── pricing-sync
      └─ fallback: Prometheus import ─────────────────────────▲   │
GitHub Copilot / other OTel sources ──OTLP──▶ Collector       Grafana (5 s refresh)
```

| Component | Where | Role |
|---|---|---|
| OpenCode plugin | `plugins/opencode` | Turns OpenCode usage events (`message.updated` on 1, `session.step.*` on 2) into token metrics ([plugin.md](plugin.md)) |
| OTel Collector | `collector/config.yaml` | Single OTLP entry (4317 grpc, 4318 http); normalisation point for sources |
| VictoriaMetrics | `compose.yaml` | Time-series store, OTLP + Prometheus ingest, 1 year retention |
| Grafana | `grafana/` | Dashboards and datasource provisioned as code (`ai-usage-projects`, `ai-context-adapter`, see [dashboard.md](dashboard.md)) |
| pricing-sync | `pricing/` | Writes USD price and credit-rate gauges ([pricing.md](pricing.md)) |

All ports bind to `127.0.0.1`; the stack is single-machine by design (ADR 0012).

## Data flow of one token event

1. OpenCode 1 emits `message.updated` for an assistant message with cumulative `tokens` (several times while streaming). OpenCode 2 emits per-step usage (`session.step.ended`/`failed`) and `session.compaction.ended`.
2. `TokenTracker` computes the delta since the last update of that `message.id` and adds it to a cumulative per-series sum (labels: type, provider, model, project, session).
3. `Exporter` flushes dirty series every 5 s (and on dispose) as a cumulative OTLP histogram, or as Prometheus text in direct mode. Failed flushes are re-queued; cumulative values make retries safe.
4. VictoriaMetrics stores `gen_ai_client_token_usage_sum|_count` ([metrics-reference.md](metrics-reference.md)).
5. Grafana queries rates/increases and joins the price gauges written by pricing-sync to show cost (USD at list price).

## Plugin internals

`index.ts` (wiring, shared reference-counted state) → `tracker.ts` (delta + dedupe) → `exporter.ts` (timer, serialised flush, never throws) → `otlp.ts` / `prometheus.ts` (serializers). `config.ts` and `project.ts` resolve settings from env and plugin options. The plugin has no runtime dependencies.

## Cross-cutting rules

- Tokens are stored, cost is computed at query time (ADR 0006).
- Plugin errors must never break opencode: all export failures are caught and logged once via `client.app.log`.
- No toast/console output from the plugin (see [opencode-plugin-workarounds.md](opencode-plugin-workarounds.md)).
