# 0007. Per-model credit rates via price gauges

- Status: Superseded by 0014
- Date: 2026-10-13

## Context
"Credits" are defined per model (credits per 1M tokens, per token type), not as one global factor. USD list prices exist in `https://models.dev/api.json` (per 1M tokens: input, output, cache_read, cache_write — verified). The source for credit rates is not yet determined.

## Decision
A `pricing-sync` job writes gauges `model_price_usd_per_mtok` and `model_credits_per_mtok` (labels `gen_ai_provider_name`, `gen_ai_request_model`, `gen_ai_token_type`) into VictoriaMetrics. `pricing/overrides.yaml` allows manual corrections and wins over fetched data. A Grafana variable switches between tokens, credits and USD.

## Consequences
- Prices and rates are data in the TSDB, editable without touching dashboards.
- The credit-rate source needs a spike (machine-readable source, scraped docs table, or manual).

## Alternatives considered
- One global credits-per-USD factor — does not match per-model credit tables.
- Prices hard-coded in dashboard JSON — hard to update.
