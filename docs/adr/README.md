# Architecture Decision Records

Every significant decision gets an ADR here. Format: [MADR](https://adr.github.io/madr/)-style, one file per decision, numbered, never deleted — a changed decision gets a new ADR that supersedes the old one (set the old one's status to `Superseded by NNNN`).

Start from [template.md](template.md). Update this index in the same change.

| # | Title | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-otlp-transport-with-direct-write-fallback.md) | OTLP as default transport, direct write as fallback | Accepted |
| [0003](0003-victoriametrics-as-time-series-store.md) | VictoriaMetrics as time-series store | Accepted |
| [0004](0004-grafana-for-dashboards.md) | Grafana for dashboards | Accepted |
| [0005](0005-genai-semantic-conventions-as-canonical-model.md) | OTel GenAI semantic conventions as canonical metric model | Accepted |
| [0006](0006-store-tokens-compute-cost-at-query-time.md) | Store raw tokens, compute cost at query time | Accepted |
| [0007](0007-per-model-credit-rates-via-price-gauges.md) | Per-model credit rates via price gauges | Superseded by 0014 |
| [0008](0008-project-label-resolution.md) | Resolution order for the `project` label | Accepted |
| [0009](0009-plugin-shared-state-for-double-bootstrap.md) | Shared, reference-counted plugin state (double bootstrap) | Superseded |
| [0010](0010-bundled-single-file-plugin-distribution.md) | Distribute the plugin as one bundled file in the global plugins dir | Superseded by 0018 |
| [0011](0011-bun-and-mise-tooling.md) | Bun and mise as tooling | Superseded by 0018 (plugin part) |
| [0012](0012-standalone-localhost-compose-stack.md) | Standalone, localhost-only Compose stack | Accepted |
| [0013](0013-low-latency-query-visibility.md) | Reduce VictoriaMetrics query latency offset for live views | Accepted |
| [0014](0014-credits-derived-from-usd-prices.md) | Credits derived from USD prices; pricing source models.dev | Accepted |
| [0015](0015-dashboard-structure-and-price-handling.md) | Dashboard structure and handling of missing prices | Superseded by 0017 |
| [0016](0016-copilot-spans-to-metrics.md) | Derive Copilot token metrics from spans in the collector | Accepted |
| [0017](0017-per-project-dashboard-replaces-single-dashboard.md) | Per-project dashboard replaces the single dashboard | Accepted |
| [0018](0018-one-plugin-bundle-for-opencode-1-and-2.md) | One plugin bundle for OpenCode 1 and 2, built without Bun | Accepted |
| [0019](0019-grafana-unmodified-official-image-only.md) | Grafana: unmodified official image only | Accepted |
