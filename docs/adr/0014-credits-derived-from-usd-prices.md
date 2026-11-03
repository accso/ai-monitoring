# 0014. Credits derived from USD prices; pricing source models.dev

- Status: Accepted (implemented, `pricing/`, see docs/pricing.md)
- Date: 2026-10-13
- Supersedes: 0007

## Context
ADR 0007 assumed separate per-model credit rates from an unknown source. Research (2026-10-13) of the official GitHub docs (`docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing`) shows: GitHub bills per 1M tokens in USD (input, cached input, cache write, output) and **1 AI credit = $0.01 USD**, so credits per 1M tokens = USD price × 100. models.dev (`api.json`, provider `github-copilot`, model ids with dots such as `claude-sonnet-5.5`) carries the same USD prices (input, output, cache_read, cache_write) and has no credit field. Anthropic's direct API bills in USD per token with no credits concept; models.dev's `anthropic` prices match Anthropic's page (model ids with dashes). The team assumed 0.01 EUR per credit; GitHub documents USD only.

## Decision
`pricing-sync` fetches USD prices per 1M tokens from models.dev and writes `model_price_usd_per_mtok`. `model_credits_per_mtok` is derived as USD × 100, only for provider `github-copilot` (the only credit-based provider). The currency value of a credit is a Grafana variable `usd_per_credit` (default 0.01) so the EUR/USD question stays a setting, not code. `reasoning` tokens get a price row equal to the output price (GitHub does not document reasoning separately; unverified assumption). `pricing/overrides.yaml` can override any value.

## Consequences
- One source, no scraping; GitHub's docs remain the reference for spot checks.
- Known limitation: long-context tiers (e.g. higher price above 100K/200K/272K input tokens, per model) are not modelled; base-tier prices are used, which underestimates cost for very large prompts. Needs context size per message to fix.
- Promotional prices (e.g. Gemini Flash until 2026-12-31) and models.dev mismatches must be handled via overrides.

## Alternatives considered
- Scraping the GitHub docs table — fragile; the data matches models.dev anyway.
- Parsing the Liquid/Markdown source in `github/docs` — data file not located, more coupling.
