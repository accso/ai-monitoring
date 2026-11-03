# 0015. Dashboard structure and handling of missing prices

- Status: Superseded by 0017
- Date: 2026-10-13

## Context
The dashboard must show tokens, credits and cost per project/model/provider over time, switchable grouping, and work before price data exists.

## Decision
One provisioned dashboard `ai-usage.json` (uid `ai-monitoring-usage`) with rows Live, Tokens, Credits, Cost. Variables: `project`, `provider`, `model` (chained, multi), `group` (project|model|provider|session|token type) and `usd_per_credit`. Instead of a single unit switch (not expressible in one query) tokens, credits, USD and EUR have their own panels. Cost queries join price gauges with `on(provider, model, token type) group_left()`; series without a price are dropped from the cost and counted in the "Tokens without USD price / credit rate" stats, so gaps are visible instead of silently zero.

## Consequences
- Dashboard JSON is edited as code (provisioned, `allowUiUpdates: false`); UI edits must be exported back.
- Until pricing-sync exists, credit and cost panels are empty and the "without price" stats equal all tokens.

## Alternatives considered
- One panel with a unit variable — would need the weight as a metric for tokens too and hides unpriced data.

> Superseded in part by ADR 0017: the `ai-usage.json` dashboard was replaced by `ai-usage-projects.json`.
