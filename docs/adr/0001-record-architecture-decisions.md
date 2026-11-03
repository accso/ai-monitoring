# 0001. Record architecture decisions

- Status: Accepted
- Date: 2026-10-13

## Context
The stack spans several tools (plugin, collector, TSDB, Grafana). Reasons behind choices get lost quickly, and some were found by trial and error (e.g. VictoriaMetrics flags, opencode double bootstrap).

## Decision
Every significant decision gets an ADR under `docs/adr/` using `template.md`. ADRs are immutable once accepted; changes are made by a superseding ADR. The index in `docs/adr/README.md` is updated in the same change.

## Consequences
Small overhead per decision; decisions and their trade-offs stay discoverable and reviewable.

## Alternatives considered
- Only the plan document — mixes plan and rationale, gets rewritten, loses history.
