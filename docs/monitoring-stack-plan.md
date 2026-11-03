# ai-monitoring — OpenCode Token/Cost Observability: Plan

Status: **in progress** (Phases 1 to 4 done: stack, OpenCode plugin, pricing-sync, dashboard; Copilot source connected (ADR 0016)). Replaces the earlier Copilot/Claude-Code-centric draft.

## 1. Goals

- Live dashboard (Grafana), startable via `docker compose`, scripts run through `mise`.
- Tokens are tracked raw; **cost and credits are computed at query time** from configurable price tables, so price changes apply retroactively.
- An OpenCode plugin tracks (v1) input, output, cache-read and cache-write tokens plus model and provider.
- Dashboard can show tokens / credits / USD **per project / model / provider over time**.

- **Any OTel-capable tool can be connected** by pointing its OTLP endpoint at the collector (GitHub Copilot first, via its OTel settings in the IDE plugin/CLI). No per-tool code on the backend side.

Non-goals (for now): multi-user/team deployment, alerting, Claude Code (not used).

## 2. Architecture

```
OpenCode plugin ──OTLP/HTTP──▶ OTel Collector ──▶ VictoriaMetrics ◀── pricing-sync (gauges)
        └── fallback: direct write (Prometheus import) ──────────▲
                                                      Grafana (live, 5s refresh)
```

- **Transport:** OTLP by default; direct write to VictoriaMetrics as fallback, selected via env (`AI_MONITORING_TRANSPORT=otlp|direct`).
- **Storage:** VictoriaMetrics single-node (native OTLP + Prometheus import, MetricsQL).
- **UI:** Grafana with datasource and dashboards provisioned as code.
- Standalone Compose project `ai-monitoring`, no dependency on other repos.

Pinned versions (checked 2026-10-13): VictoriaMetrics v1.154.0, otel-collector-contrib 0.162.0, Grafana 13.2.3.

## 3. Metrics model

### 3.0 Multi-source ingestion
- All sources send OTLP to the collector (`:4318` http, `:4317` grpc). Each source is identified by `service.name` (label `service_name`).
- **Canonical model = OTel GenAI semantic conventions**: `gen_ai.client.token.usage` with `gen_ai.token.type`, `gen_ai.provider.name`, `gen_ai.request.model`. The OpenCode plugin emits this same shape, so Copilot and OpenCode need no tool-specific dashboard logic.
- Differences between sources (delta vs cumulative temporality, attribute names, histogram vs counter) are normalised **in the collector pipeline** (e.g. `deltatocumulative`, `transform`), not in Grafana queries. Adding a source = adding a short collector config snippet plus a documented mapping in `docs/sources/<tool>.md`.
- Known gap to verify in a spike: Copilot's token metric documents only `input`/`output`; cache read/write may only exist on spans, if at all. Dashboards must tolerate missing token types per source.
- Traces/logs from sources are accepted by the collector but not stored until a use case exists.

### 3.1 OpenCode plugin metric

Emitted as an OTLP cumulative histogram `gen_ai.client.token.usage` (unit `{token}`, a single catch-all bucket, so `_sum` = tokens and `_count` = messages) with attributes
`gen_ai.token.type` (input|output|reasoning|cache_read|cache_write — the last two are extensions), `gen_ai.provider.name`, `gen_ai.request.model`, plus `project`, `session_id`.
VictoriaMetrics runs with `-opentelemetry.usePrometheusNaming`, so the stored series are
`gen_ai_client_token_usage_sum` / `_count` with labels `gen_ai_token_type`, `gen_ai_provider_name`, `gen_ai_request_model`, `project`, `session_id`, `service_name`, `service_instance_id`.
The direct-write fallback produces exactly the same series names and labels.
Tokens (not cost) are counted; `reasoning` is priced at the output rate.

`project` resolution order: env `AI_MONITORING_PROJECT` → plugin config → git repo name → cwd basename.

Plugin must dedupe by `message.id` (`message.updated` fires repeatedly) and only emit deltas. Counter resets on restart are handled by `increase()`.

Price gauges written by pricing-sync:
- `model_price_usd_per_mtok{gen_ai_provider_name,gen_ai_request_model,gen_ai_token_type}`
- `model_credits_per_mtok{gen_ai_provider_name,gen_ai_request_model,gen_ai_token_type}`

Cost = `sum(increase(tokens) * on(gen_ai_provider_name,gen_ai_request_model,gen_ai_token_type) group_left price) / 1e6`.

## 4. Pricing and credits

See ADR 0014.
- GitHub Copilot: 1 AI credit = $0.01 USD (official docs); credits per 1M tokens = USD price x 100. The dashboard shows USD at list price only; credits can be queried by hand (docs/pricing.md).
- USD prices per 1M tokens (input, output, cache_read, cache_write) from `https://models.dev/api.json` (matches GitHub's and Anthropic's official tables, verified 2026-10-13). opencode ids: provider `github-copilot` with dotted model ids (`claude-sonnet-5.5`), provider `anthropic` with dashed ids.
- Anthropic direct: USD only, no credits concept.
- `reasoning` priced at the output rate (unverified assumption); `pricing/overrides.yaml` wins over fetched data.
- Known limitation: long-context price tiers are not modelled.
- Runs as compose service `pricing-sync`; one-off via `mise run pricing:sync` (docs/pricing.md).

## 5. Dashboard

Implemented (ADR 0015, ADR 0017, `grafana/dashboards/ai-usage-projects.json`, see `docs/dashboard.md`): a total row plus one repeated row per selected project (tokens by group and by type, cost at list price, tokens, burn rate); filters project/provider/model/agent/resolution. The earlier single dashboard with credit panels was removed. A second dashboard, `grafana/dashboards/ai-context-adapter.json` (tool-call latency from the ai-context plugin), is described in `docs/dashboard.md`.

## 5a. Documentation and decisions

- Every significant decision gets an ADR in `docs/adr/` (index in `docs/adr/README.md`, ADR 0001).
- Document set: `architecture.md`, `getting-started.md`, `plugin.md`, `dashboard.md`, `metrics-reference.md`, `releasing.md`, `opencode-plugin-workarounds.md`, `pricing.md`, `metrics-catalog.md` and `sources/<tool>.md`. Docs are updated in the same change as the code they describe.
- Plugin install/uninstall: `scripts/install-plugin.sh` (via `mise run plugin:install`). Release process: skill `.github/skills/plugin-release`.

## 6. Phases (each its own commit/PR, verified before the next)

1. **Stack scaffold:** compose (collector, VictoriaMetrics, Grafana), provisioning, `mise.toml` tasks `up|down|logs|status`; verify healthchecks via curl.
2. **OpenCode plugin v1:** 4 token types, labels, both transports, unit tests (delta + dedupe + project resolution).
3. **Pricing sync:** USD prices, credit rates, overrides, gauges in VictoriaMetrics.
4. **Dashboard:** variables and panels above, provisioned as code.
5. **GitHub Copilot source:** spike with real Copilot OTel output (check temporality, attributes, cache tokens), collector normalisation, `docs/sources/github-copilot.md`; generic recipe for adding further OTel sources.
6. **Later:** tool calls, latency, errors, reasoning tokens, retention tuning, alerting (vmalert).

## 7. Open points

- Handling of long-context price tiers (needs context size per message).
- Whether reasoning tokens are billed at the output rate by Copilot (unverified).
- Retention period for metrics.
