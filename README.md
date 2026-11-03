# ai-monitoring

Live monitoring of AI coding-agent usage (tokens, cost, credits) per project, model and provider: OpenCode plugin → OTel Collector → VictoriaMetrics → Grafana. Any OTel GenAI source (e.g. GitHub Copilot) can be connected.

Start with [docs/getting-started.md](docs/getting-started.md).

| Document | Content |
|---|---|
| [docs/monitoring-stack-plan.md](docs/monitoring-stack-plan.md) | Goals, phases, open points |
| [docs/architecture.md](docs/architecture.md) | Components and data flow |
| [docs/adr](docs/adr/README.md) | Architecture decision records |
| [docs/metrics-catalog.md](docs/metrics-catalog.md) | All available OpenCode/Copilot metrics, used vs. unused |
| [docs/pricing.md](docs/pricing.md) | Price sync, credits, overrides |
| [docs/dashboard.md](docs/dashboard.md) | Dashboard panels, variables, editing |
| [docs/plugin.md](docs/plugin.md) | OpenCode plugin: install, configuration |
| [docs/metrics-reference.md](docs/metrics-reference.md) | Series, labels, queries |
| [docs/releasing.md](docs/releasing.md) | Plugin release flow |
| [docs/opencode-plugin-workarounds.md](docs/opencode-plugin-workarounds.md) | opencode plugin API pitfalls |

## Author

Created and maintained by **Florestan Sulimma** at **Accso GmbH**.

## License

Apache License 2.0, Copyright 2026 Accso GmbH — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Third-party components (e.g. Grafana, run unmodified from its official image): see [THIRD-PARTY-LICENSES.md](THIRD-PARTY-LICENSES.md).
