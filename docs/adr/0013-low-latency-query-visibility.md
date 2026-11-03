# 0013. Reduce VictoriaMetrics query latency offset for live views

- Status: Accepted
- Date: 2026-10-13

## Context
By default VictoriaMetrics hides the most recent 30 s of data from queries (`-search.latencyOffset`). Our integration tests and the live dashboard saw "no data" for freshly ingested samples.

## Decision
Run VictoriaMetrics with `-search.latencyOffset=1s`.

## Consequences
- Near-real-time dashboards. Very recent points may be incomplete for a moment; acceptable for cumulative counters.

## Alternatives considered
- Keep the default and accept 30 s lag — poor "live" experience.
