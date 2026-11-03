# Metrics reference

## Token usage (OpenCode plugin and any GenAI-semconv source)

Stored series (VictoriaMetrics with `-opentelemetry.usePrometheusNaming`):

| Series | Meaning |
|---|---|
| `gen_ai_client_token_usage_sum` | Cumulative tokens |
| `gen_ai_client_token_usage_count` | Cumulative number of messages that contributed tokens of that type |
| `gen_ai_client_token_usage_bucket{le="+Inf"}` | Same as count (single catch-all bucket; OTLP path only) |

Labels:

| Label | Values |
|---|---|
| `gen_ai_token_type` | `input`, `output`, `reasoning`, `cache_read`, `cache_write` (the last three are extensions; other sources may lack them) |
| `gen_ai_provider_name` | opencode `providerID`, e.g. `github-copilot` |
| `gen_ai_request_model` | opencode `modelID` |
| `project` | see ADR 0008 |
| `gen_ai_agent_name` | opencode agent (`build`, `plan`, `explore`, ...); `unknown` if not reported; absent on data from before plugin 0.3.0 |
| `session_id` | opencode session id |
| `service_name` | source, plugin default `opencode` |
| `service_instance_id` | one per opencode process |

Useful queries:

```promql
# tokens per model over the dashboard range
sum by (gen_ai_request_model) (increase(gen_ai_client_token_usage_sum[$__range]))

# cache hit share
sum(increase(gen_ai_client_token_usage_sum{gen_ai_token_type="cache_read"}[$__range]))
  / sum(increase(gen_ai_client_token_usage_sum{gen_ai_token_type=~"input|cache_read"}[$__range]))
```

Counters reset when an opencode process restarts; `increase()`/`rate()` handle resets.

## Price gauges (pricing-sync, ADR 0014, see pricing.md)

`model_price_usd_per_mtok` and `model_credits_per_mtok`, labels `gen_ai_provider_name`, `gen_ai_request_model`, `gen_ai_token_type`.

Cost: `sum by (...) (increase(tokens) * on(gen_ai_provider_name, gen_ai_request_model, gen_ai_token_type) group_left() price) / 1e6`.
