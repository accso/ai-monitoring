# 0003. VictoriaMetrics as time-series store

- Status: Accepted
- Date: 2026-10-13

## Context
We need a long-lived, lightweight, single-developer time-series store that accepts OTLP and Prometheus-format data and supports PromQL-style queries for Grafana.

## Decision
Use VictoriaMetrics single-node (pinned image). It ingests OTLP natively (`/opentelemetry/v1/metrics`) and Prometheus text import, is a single binary, and is queryable via the Prometheus API/MetricsQL.

## Consequences
- Low resource use and trivial Compose setup; Grafana uses its Prometheus datasource type.
- Behaviour must be tuned by flags (ADR 0005, 0013).
- Traces are not stored yet; VictoriaTraces or Tempo can be added when needed.

## Alternatives considered
- Prometheus — needs the OTLP receiver feature flag and higher resource use; no direct import API.
- InfluxDB/TimescaleDB — different query model, no Prometheus-compatible API for Grafana dashboards with MetricsQL.
