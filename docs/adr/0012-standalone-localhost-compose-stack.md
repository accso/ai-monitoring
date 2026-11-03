# 0012. Standalone, localhost-only Compose stack

- Status: Accepted
- Date: 2026-10-13

## Context
The stack is a single-developer, always-on side-car. It must not depend on other repos and must not expose telemetry to the network.

## Decision
One self-contained Compose project `ai-monitoring` with pinned images; all ports bound to `127.0.0.1`; named volumes; Grafana with anonymous admin access (safe only because of the localhost binding); VictoriaMetrics retention 1 year.

## Consequences
- Simple and safe for a single machine.
- Not suitable for a shared team deployment without auth, TLS and a different port exposure (out of scope).

## Alternatives considered
- Joining another repo's Docker network — creates coupling.
- Grafana login — friction without benefit on localhost.
