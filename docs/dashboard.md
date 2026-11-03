# Dashboard

Grafana: http://127.0.0.1:3000 → "AI usage: per project overview" (uid `ai-monitoring-projects`, refresh 5 s, default range 6 h). Provisioned from `grafana/dashboards/ai-usage-projects.json` (ADR 0015, ADR 0017 for the current structure).

The former "AI usage: tokens, credits, cost" dashboard (`ai-usage.json`, with credit panels, Copilot cross-check and cache hit rate) was removed. Credits and the Copilot comparison can still be queried by hand, see `pricing.md`.

## Layout

- **Total (all projects)**: one row of five panels without a project filter: tokens over time by model, by agent and by token type (graphs, legend as a table below each graph, nine grid units high so the five token-type rows are visible) and, in one column on the right: Cost USD (list price over the range), Tokens (range), Cache reads per write (cache read tokens divided by cache write tokens over the range, shown as a plain number; higher is better) and Burn rate /min (average tokens per minute over active intervals).
- **Project rows**: the same five panels per project. Colors: cost by threshold (green up to 50 USD, orange 50 to 100, red above), tokens pink, burn rate orange, cache reads per write by threshold (red below 10, orange 10 to 25, green above 25).

## Legend and names

- Agents: every row (the total and one per project) shows model, agent and token-type graphs side by side, with the stat column on the right. The `Agent` variable filters every graph. Data from before plugin 0.3.0 has no agent label and appears as "(no agent)"; Copilot data has none either.
- Model names are read from the data (`gen_ai_request_model`, as the tool reports them); the stack does not set them. The model graphs only rename them for display with a `renameByRegex` transformation (`claude-sonnet-5-5` and `claude-sonnet-5.5` become `sonnet 5.5`; dated ids lose the date). Queries, joins and prices still use the original labels, so nothing else changes. Names that do not match the pattern (other providers, sessions, ...) are shown unchanged.
- The same model can appear twice with the same display name when it is reported by two providers (Anthropic uses dashes, Copilot dots); they are separate series with separate totals.
- Colors use `palette-classic-by-name`: a series gets the same color in every graph and row because the color is derived from the display name. `sonnet 5.5` is pinned to green (override in the by-Model panels); add further overrides there to pin other models.
- The legend is a table below the graph (name left, Total right-aligned, sorted by Total), so columns line up across rows. It costs height: about one total row plus one to two project rows fit on a screen without scrolling. A table with many series scrolls inside the panel.

## Variables

| Variable | Purpose |
|---|---|
| Projects | multi-select (lists projects with data in the last 30 days). `All` is the default: every project gets a row. Pick specific projects to show only those, and add or remove rows with the dropdown and the chips' x. |
| Provider / Model | multi-select filters, not chained to the project selection |
| Agent | Filters every graph by agent name |
| Resolution | bucket size of the time-series panels. `Auto` targets about 30 buckets for the range (min 1 m); 1 m … 1 d forces a size |
| Shown projects (hidden) | derived from Projects; the project row repeats over it |

Notes and Grafana limits:

- The legend is part of the panel options, so it cannot be toggled in view mode: click a series name to isolate it, hover for all values, or edit the panel (Legend → Visibility) to hide it. Selected projects stay in the dropdown (shown as checked); Grafana cannot hide them. Provisioned dashboards cannot get a per-row close button, so the chip x removes a row. Rows can still be collapsed.
- Selecting a project while `All` is selected replaces `All` with that project; removing the last chip returns to `All`.
- Cost stat panels sum the per-interval cost over the range (`sum_over_time((...)[$__range:$__interval])`), so price changes within the range are respected (see `pricing.md`, price history). Cost is USD at list price; there is no credit conversion.

## Changing the dashboard

`allowUiUpdates` is off. Edit in Grafana, export the JSON (Share → Export, "for sharing externally" off), and replace `grafana/dashboards/ai-usage-projects.json`; bump `version`. Grafana reloads it within about 10 s (a changed file may need `docker compose restart grafana`). Keep the join labels `gen_ai_provider_name, gen_ai_request_model, gen_ai_token_type`.

## Second dashboard: ai-context adapter

"ai-context adapter: tool latency per project" (uid `ai-context-adapter`, refresh 10 s, default range 6 h), provisioned from `grafana/dashboards/ai-context-adapter.json`. It shows tool-call counts and latency from the ai-context OpenCode plugin (`ai-context-opencode-plugin`), which is not part of this repository. That plugin exports the histogram `opencode.tool.duration` (stored as `opencode_tool_duration_milliseconds_*`, `service_name="ai-context"`, label `project`, `tool`) when its opt-in OTLP export is enabled (`AI_CONTEXT_OTEL_ENABLED=1`, endpoint `AI_CONTEXT_OTEL_ENDPOINT`, default `http://127.0.0.1:4318`; see that repo's `docs/observability.md`). Without it the dashboard stays empty.

- **Rows**: tool categories (ai-context tools vs MCP tools vs base tools, split by tool name regex), a total row (calls, active projects, time in tools, average/p50/p95 latency, graphs by the chosen group, table per project and tool) and one row per project.
- **Variables**: Projects, Tool, Group by (tool, project or instance) and Resolution.
- The tool-name lists that define the categories are regexes inside the dashboard JSON; update them when new built-in tools appear.
