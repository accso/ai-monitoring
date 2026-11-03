# 0016 — Derive Copilot token metrics from spans in the collector

Status: accepted (2026-10-13)

## Context

Copilot's native `gen_ai.client.token.usage` metric has only input/output types, the provider `github` and counts cache tokens inside input. Its chat spans carry the full breakdown and the credits Copilot itself charged.

## Decision

Derive the metric from chat spans with the collector's `signal_to_metrics` connector, normalise it to the canonical labels and drop the native metric. Expose Copilot's reported credits as `github.copilot.credits`.

## Consequences

- OpenCode and Copilot series share one schema and the same dashboard queries.
- Fresh input is computed as input − cache read − cache write.
- Copilot's reported credits give a ground truth for the price-based credit calculation.
- Trace data is only used for this derivation and is not stored.
