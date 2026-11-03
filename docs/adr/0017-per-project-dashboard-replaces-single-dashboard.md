# 0017. Per-project dashboard replaces the single dashboard

- Status: Accepted
- Date: 2026-10-21

## Context

The single dashboard `ai-usage.json` (ADR 0015) showed one aggregated view with a project filter. Users wanted several projects side by side plus a total, and found the credit and Copilot-comparison panels unnecessary.

## Decision

Provision only `ai-usage-projects.json`: a total row and one repeated row per selected project, driven by a multi-select `project` variable with an `All` default and a hidden derived variable `shown` that the project row repeats over. Cost stats sum per-interval cost over the range so price history is respected. `ai-usage.json` is deleted. Prices keep being joined at query time (ADR 0006); dated price history lives in `pricing/overrides.yaml` (`from`).

## Consequences

- Credits and the Copilot cross-check have no panel any more; they stay available as PromQL (`docs/pricing.md`).
- Grafana always renders one placeholder row when no project is selected, and cannot hide selected projects from the dropdown.
