# 0009. Shared, reference-counted plugin state (double bootstrap)

- Status: Superseded (PluginModule format `default { id, server }`; one tracker/exporter per server call, verified live without double counting on 2026-10-13)
- Date: 2026-10-13

## Context
opencode invokes the plugin function twice per session (see `docs/opencode-plugin-workarounds.md` §2) and both hook sets receive every event. Separate trackers and exporters would count every token twice.

## Decision
Tracker and exporter live in one module-level shared instance, created on first bootstrap and reference-counted. Each hook set releases its reference on `dispose`; the last release stops the exporter (final flush) and clears the shared state. Token deltas are additionally deduplicated per `message.id`.

## Consequences
- No double counting; one timer and one `service.instance.id` per process.
- State is per process: concurrent opencode processes produce separate series (distinguished by `service_instance_id`), which `sum by (...)` aggregates.

## Alternatives considered
- Time-window dedup gate — only suppresses user-visible side effects, not state duplication.
