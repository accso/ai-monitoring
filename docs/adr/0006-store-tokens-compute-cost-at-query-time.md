# 0006. Store raw tokens, compute cost at query time

- Status: Accepted
- Date: 2026-10-13

## Context
Prices change and credit rates are configurable; the plugin does not know current prices.

## Decision
Only token counts are stored. Cost and credits are calculated in the query: tokens × price gauge / 1e6, joined on provider, model and token type. `reasoning` is priced at the output rate.

## Consequences
- Price corrections apply retroactively; no re-ingestion.
- Queries are more complex (joins); missing price data yields no cost for that series (must be visible in the dashboard).
- OpenCode's own per-message `cost` field is intentionally not used (single source of truth for prices).

## Alternatives considered
- Plugin computes cost at write time — freezes prices, needs price data inside the plugin.
