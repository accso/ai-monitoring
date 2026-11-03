# Third-party licenses (code shipped with ai-monitoring)

ai-monitoring is licensed under the Apache License 2.0 (see [LICENSE](LICENSE) and [NOTICE](NOTICE)).

The plugin bundle (`plugins/opencode/dist/ai-monitoring.js`) and the pricing sync (`pricing/src`) contain
**no third-party code**. The only imports from npm packages are type-only (`@opencode-ai/plugin`,
`@opencode/plugin`) and are erased at build time. There are therefore no third-party licence texts or
copyright notices that must travel with our artifacts.

Container images referenced in `compose.yaml` (OpenTelemetry Collector, VictoriaMetrics, Grafana, Bun) are
pulled unmodified from their upstream registries on the user's machine. They are not shipped by us, and their
own licences apply. Grafana (AGPL-3.0) is used only as an unmodified official image, see
[ADR 0019](docs/adr/0019-grafana-unmodified-official-image-only.md).

If a runtime dependency is ever bundled, list it here with its version, licence and full licence text.
