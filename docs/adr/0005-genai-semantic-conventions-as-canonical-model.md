# 0005. OTel GenAI semantic conventions as canonical metric model

- Status: Accepted
- Date: 2026-10-13

## Context
Multiple sources (OpenCode plugin, GitHub Copilot, later others) must appear in the same dashboards without tool-specific queries.

## Decision
The canonical model is `gen_ai.client.token.usage` with `gen_ai.token.type`, `gen_ai.provider.name`, `gen_ai.request.model`, extended by `project` and `session_id`. The plugin emits it as a cumulative histogram with one catch-all bucket (`_sum` = tokens, `_count` = messages), because VictoriaMetrics drops histograms without `bucketCounts` and Copilot emits the same histogram type. Extension token types: `reasoning`, `cache_read`, `cache_write`.

VictoriaMetrics runs with `-opentelemetry.usePrometheusNaming` and `-opentelemetry.promoteScopeMetadata=false`, so stored series are `gen_ai_client_token_usage_sum|_count` with underscore labels. Source differences (temporality, attribute names) are normalised in the collector, not in Grafana queries.

## Consequences
- New OTel sources need only a collector snippet and a mapping note.
- Cache tokens may be missing for some sources; dashboards must tolerate absent token types.
- Verified: a histogram without `bucketCounts` is silently dropped (0 rows inserted).

## Alternatives considered
- Own metric schema (`ai_tokens_total`) — every source needs mapping up front and loses semconv alignment.
- Plain counter in the plugin — different metric type than other sources.
