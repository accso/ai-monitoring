# Changelog

## 0.3.0

- New label `gen_ai.agent.name` (`gen_ai_agent_name`) on `gen_ai.client.token.usage`: OpenCode 1 from `info.agent ?? info.mode`, OpenCode 2 from `session.step.started.agent` (compaction: `compaction`). `unknown` when not reported. Subagents appear under their own agent name.

## 0.2.0

- **OpenCode 2 support.** One bundle for both versions: default export `{ id, setup(ctx) }` for OpenCode 2 (usage from `ctx.event.subscribe`: `session.step.started/ended/failed`, `session.compaction.ended`; project from `ctx.location`) plus `server` for OpenCode 1 (unchanged behaviour).
- Runtime-neutral tooling (no Bun): Vitest tests, Node/npm, esbuild bundle (`dist/ai-monitoring.js`). Install is still the single file `plugins/ai-monitoring.js`; a stale `plugins/ai-monitoring/` directory is removed.
- V2 usage is per step (events carry per-step tokens); compaction usage is counted too.
- Supports OpenCode 1 >= 1.19 and OpenCode 2 (verified live on 1.19.4 and 2.2.0); compaction usage verified live on 2.2.0.
- OpenCode 2 warnings (e.g. stack unreachable) are written to `~/.local/share/opencode/log/ai-monitoring.log`: V2 gives plugins no logger and does not forward console output to opencode.log.

## 0.1.x (OpenCode 1)

- Export as PluginModule (`default { id: "ai-monitoring", server }`); removed the double-bootstrap workaround (shared state/refcount). Verified live: token sums per type match opencode DB exactly, no duplicate series.

## 0.1.0

- Initial version: input, output, reasoning, cache read and cache write tokens per provider, model, project and session as `gen_ai.client.token.usage`; OTLP and direct-write transports.
