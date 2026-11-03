# Pricing and credits

Prices and credits are not stored with the usage data. A small service, `pricing-sync` (compose, `pricing/`), writes them as gauges, and Grafana multiplies tokens by price at query time (ADR 0014, 0015).

## Data flow

1. `pricing-sync` fetches https://models.dev/api.json every 6 h (cached in memory; on a failed refresh the last prices keep being pushed).
2. For the providers in `PRICING_PROVIDERS` (default `github-copilot,anthropic,openai`) it maps `cost.input/output/cache_read/cache_write` (USD per 1M tokens) to token types. `reasoning` is priced like `output` unless the source has its own value (unverified assumption).
3. `pricing/overrides.yaml` is applied on top.
4. Every 30 s the gauges are pushed to VictoriaMetrics (`/api/v1/import/prometheus`), so they are always within the query lookback window.

| Gauge | Labels | Meaning |
|---|---|---|
| `model_price_usd_per_mtok` | `gen_ai_provider_name`, `gen_ai_request_model`, `gen_ai_token_type` | USD per 1M tokens |
| `model_credits_per_mtok` | same | Credits per 1M tokens, **only** `github-copilot`: USD × 100 (1 credit = $0.01) |

Join in dashboards: `increase(tokens) * on(gen_ai_provider_name,gen_ai_request_model,gen_ai_token_type) group_left() model_credits_per_mtok / 1e6`. The label values must equal what the sources send: provider ids as models.dev names them (opencode `providerID`), model ids with dots for `github-copilot` and dashes for `anthropic`.

## Currency

Credits are exact (USD × 100, 1 credit = $0.01). GitHub documents credits in USD only. The dashboard shows cost in USD at list price and has no credit conversion; the `model_credits_per_mtok` gauge and `github_copilot_credits_total` can be queried by hand (see below).

## Verification against Copilot

Copilot reports its own credits per call (`github_copilot_credits_total`). Compare:

```promql
sum(increase(gen_ai_client_token_usage_sum{service_name="github-copilot"}[1h])
  * on(gen_ai_provider_name,gen_ai_request_model,gen_ai_token_type) group_left() model_credits_per_mtok) / 1e6
# vs
sum(increase(github_copilot_credits_total[1h]))
```

Both agree within rounding for data after 2026-10-13 12:55 (earlier calls without zero-valued cache attributes were skipped on the token side, see `sources/github-copilot.md`).

## Overrides

`pricing/overrides.yaml` entries replace models.dev values per model: `input`, `output`, `cache_read`, `cache_write`, optional `reasoning`, and explicit `credits: {type: value}`. Use it for promotional prices, brand-new models and models.dev errors. Changes are picked up within one push interval, no restart needed.

### Price history (`from`)

An override may carry `from: 2026-09-01` (ISO date, UTC). Several entries for the same model form a price history: at any time the latest entry whose `from` has passed is used; entries without `from` always apply. On start and whenever the overrides change, `pricing-sync` backfills the gauges for dated models (last `PRICING_BACKFILL_DAYS`, default 90, one sample per 4 min on an aligned grid, so re-running is idempotent). To correct history that is already stored, delete the series first (`/api/v1/admin/tsdb/delete_series`), then change the file.

Dashboards respect price changes: time series evaluate the price per point, and the cost/credit stat panels sum the per-interval cost over the range (`sum_over_time((...)[$__range:$__interval])`) instead of applying the latest price to the whole range.

## Operating

```bash
mise run up                # starts the stack including pricing-sync
mise run pricing:logs      # follow the service
mise run pricing:sync      # one-off push from the host (needs the stack up)
mise run pricing:test      # unit tests
```

Configuration (compose environment): `PRICING_PROVIDERS`, `PRICING_SOURCE_URL`, `PRICING_PUSH_INTERVAL_SECONDS`, `PRICING_REFRESH_HOURS`, `PRICING_BACKFILL_DAYS`, `PRICING_OVERRIDES`, `VM_URL`.

## Anthropic prices

`overrides.yaml` pins Anthropic prices to https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-21), including models missing in models.dev (Mythos 5/5.1, Opus 4/4.1, Sonnet 4, Haiku 3.5) and dated/alias ids. `cache_write` is the 5-minute cache write (1.25x input).

## Known limits

- Anthropic modifiers that are not modelled, so cost can be underestimated or overestimated: 1-hour cache writes (2x input instead of 1.25x), Haiku 5.5 requests over 100,000 prompt tokens (higher tier), Batch API (-50%), fast mode (Opus 5.5/5/4.8 premium prices) and US-only inference (1.1x). The token series carry no information about these modes.
- Open question: whether OpenCode reports reasoning tokens inside `output` or separately. They are priced as `output` in their own series; if OpenCode also counts them in `output`, they are counted twice. Verify against the Claude Console.

- Long-context price tiers are not modelled; very large prompts are underestimated.
- Price history exists only from when `pricing-sync` first ran, plus whatever is backfilled via dated overrides (`from`).
- The cost stat panels are accurate to the chosen resolution (subquery step), so they can differ slightly from a single-window total.
- Local models (e.g. oMLX) have no price; the "tokens without price" stats show them.
