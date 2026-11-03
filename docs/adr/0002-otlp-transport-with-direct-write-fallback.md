# 0002. OTLP as default transport, direct write as fallback

- Status: Accepted
- Date: 2026-10-13

## Context
The OpenCode plugin must deliver metrics somewhere durable. Options are an OTel metric export or writing straight into a time-series database. GitHub Copilot (and other tools) also export OTLP, and we want to connect any OTel source.

## Decision
The plugin sends OTLP/HTTP JSON to the OTel Collector by default (`AI_MONITORING_TRANSPORT=otlp`). As fallback it can write Prometheus text directly to VictoriaMetrics (`/api/v1/import/prometheus`, `AI_MONITORING_TRANSPORT=direct`). Both paths produce identical series names and labels (see ADR 0005).

## Consequences
- Vendor-neutral standard path; the collector is the single entry for all sources.
- The fallback works without a collector, at the cost of a second serializer to keep in sync (covered by an integration test comparing both transports).
- Plugin has no OTel SDK dependency: hand-built OTLP JSON via `fetch` keeps the bundle tiny and the plugin dependency-free.

## Alternatives considered
- OTLP only — no fallback when the collector is absent.
- Direct write only — ties the plugin to one backend and ignores other OTel sources.
- OTel JS SDK in the plugin — heavy, many transitive dependencies in a globally loaded plugin.
