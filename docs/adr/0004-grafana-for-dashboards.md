# 0004. Grafana for dashboards

- Status: Accepted
- Date: 2026-10-13

## Context
We need live dashboards with switchable unit (tokens/credits/USD), grouping (project/model/provider) and filters.

## Decision
Use Grafana with datasources and dashboards provisioned as code (`grafana/provisioning`, `grafana/dashboards`). Grafana variables drive unit, grouping and filters.

## Consequences
- Fast to build, versioned dashboards, 5 s refresh; matches the VictoriaMetrics setup.
- Credit/price settings are driven by data (price gauges, ADR 0007) rather than a custom settings UI.

## Alternatives considered
- Custom web dashboard — full control over settings UI, but much more effort to build and maintain.
