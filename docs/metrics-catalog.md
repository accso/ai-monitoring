# Metrics catalog: what is available, what is used

Reference for future extensions. "Used" means stored in VictoriaMetrics today; everything else is available at the source but not yet collected. Verified against opencode SDK types (`@opencode-ai/sdk` in `plugins/opencode/node_modules`) and a raw dump of Copilot's JetBrains export (2026-10-13). Copilot's full documentation: see the sources at the end.

## 1. OpenCode (plugin hooks and events)

OpenCode 1: the plugin subscribes to `event` and uses only `message.updated`. OpenCode 2: it uses `session.step.started/ended/failed` and `session.compaction.ended` (per-step usage, so compaction is counted). Every item below is accessible to a plugin.

### Used today

| Source | Fields | Stored as |
|---|---|---|
| `message.updated` (assistant, OpenCode 1) or `session.step.ended/failed` and `session.compaction.ended` (OpenCode 2) | `tokens.input/output/reasoning/cache.read/cache.write`, `providerID`, `modelID`, `sessionID`, `id`, agent | `gen_ai_client_token_usage_*` (see `metrics-reference.md`) |
| agent | OpenCode 1 `info.agent ?? info.mode`, OpenCode 2 `session.step.started.agent` | label `gen_ai_agent_name` |
| project resolution | env, plugin config, repo name | label `project` |

### Available, not yet collected

| Candidate metric | Source (event / field) | Notes |
|---|---|---|
| Cost as computed by opencode (USD) | `AssistantMessage.cost`, `step-finish.cost` | Cross-check against the price-based calculation; may be 0 for local or unpriced models |
| Per-step token usage (OpenCode 1) | `message.part.updated` with part `step-finish` (`tokens`, `cost`, `reason`) | Finer than per message; basis for steps per message. Already used on OpenCode 2 |
| Message latency | `AssistantMessage.time.created/completed` | Histogram per model |
| Finish reason | `AssistantMessage.finish`, `step-finish.reason` | `stop`, `tool-calls`, `length`, ... |
| Errors | `AssistantMessage.error` (`ProviderAuthError`, `ApiError`, `MessageOutputLengthError`, `MessageAbortedError`, `UnknownError`), `session.error` | Counter by error type |
| Retries | part `retry` (`attempt`, `error`) | Counter per provider |
| Tool calls | part `tool` (`tool`, `state.status` pending/running/completed/error, `time.start/end`), hooks `tool.execute.before/after` | Count, duration and error rate per tool name |
| Reasoning time | part `reasoning` (`time.start/end`) | Duration |
| Subagent relationships | part `subtask` (`agent`, `description`) | Agent name is already a label; this would add the parent/child link |
| Compactions (count) | event `session.compacted`, part `compaction` (`auto`) | Counter, auto vs manual (compaction tokens are already counted on OpenCode 2) |
| Sessions | `session.created/updated/deleted/idle`, `Session.time`, `parentID` | Session count, duration, subagent depth |
| Code changes | `Session.summary` (`additions`, `deletions`, `files`), `session.diff`, `file.edited`, part `patch` (`files`) | Lines added/removed per session |
| Permission prompts | `permission.updated`, `permission.replied`, hook `permission.ask` | Count and outcome |
| Commands | `command.executed`, hook `command.execute.before` | Slash command usage |
| Todos | `todo.updated` | Task progress |
| Environment | `vcs.branch.updated`, `Session.directory`, `AssistantMessage.path.cwd/root`, `Session.version`, `Session.title` | Branch label, opencode version; high cardinality (title) should not become a label |
| Request details | hooks `chat.params` (temperature, topP, options), `chat.headers` | Model parameters, not stored by default |
| LSP | `lsp.client.diagnostics`, `lsp.updated` | Diagnostics counts |

Cardinality rules: keep `session_id` and free text (titles, paths, tool input) out of labels unless the series is aggregated away; never export prompt/response text (`text` parts, tool `input/output`) by default.

## 2. GitHub Copilot (OTel export)

JetBrains (verified by raw dump), VS Code and CLI differ. `service.name` is `github-copilot` (JetBrains and CLI) or `copilot-chat` (VS Code).

### Used today (derived in the collector, ADR 0016)

| Source | Stored as |
|---|---|
| `chat` span: `gen_ai.usage.input_tokens` (includes cache), `output_tokens`, `cache_read.input_tokens`, `cache_write.input_tokens`, `gen_ai.request.model`, `gen_ai.conversation.id` | `gen_ai_client_token_usage_*` with `gen_ai_token_type` input (fresh) / output / cache_read / cache_write |
| `chat` span: `github.copilot.nano_aiu` | `github_copilot_credits_total` (nano_aiu / 1e9) |
| Native metrics passed through unchanged: `gen_ai.client.operation.duration`, `gen_ai.execute_tool.duration`, `github.copilot.tool.call.count/duration`, `github.copilot.mcp.server.connection.count`, `github.copilot.sandbox.operation.count` | `gen_ai_client_operation_duration_seconds_*` etc. |

### Spans (traces) available

| Span | Attributes seen in JetBrains | Additional in docs (CLI / VS Code) |
|---|---|---|
| `chat <model>` | `gen_ai.operation.name`, `gen_ai.provider.name` (`github`), `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.response.id`, `gen_ai.response.finish_reasons`, `gen_ai.conversation.id`, `gen_ai.usage.*`, `gen_ai.usage.reasoning.output_tokens` (some models), `github.copilot.cost` (billing multiplier, **not** money), `github.copilot.nano_aiu`, `github.copilot.server_duration`, `github.copilot.initiator` (agent/user), `github.copilot.turn_id`, `github.copilot.interaction_id`, `github.copilot.service_request_id` | `gen_ai.request.stream/max_tokens/temperature/top_p`, `gen_ai.response.time_to_first_chunk`, `server.address/port` |
| `execute_tool <name>` | `gen_ai.tool.name`, `gen_ai.tool.type`, `gen_ai.tool.call.id`; span events for hooks and sandbox | `gen_ai.tool.description`, `error.type`, VS Code: `github.copilot.tool.parameters.*` |
| `permission` | `github.copilot.permission.kind`, `github.copilot.permission.result` | |
| `invoke_agent` (not seen in JetBrains) | | Session root: `gen_ai.agent.*`, `github.copilot.turn_count`, aggregated usage and `nano_aiu`, `enduser.pseudo.id`; VS Code adds `github.copilot.git.repository/branch/commit_sha`, `github.copilot.github.org` |

Credits caveat: `nano_aiu` is on both `invoke_agent` and its child `chat` spans, so sum only one level (we use `chat`).

### Span events

`github.copilot.session.usage_info` (`token_limit`, `current_tokens`, `messages_length`: context window fill), `github.copilot.hook.start/end/error` (`hook.type`, `decision`, `duration`, `tool_names`), `github.copilot.sandbox.enforcement_state` (`control`, `outcome`, `platform`, `backend`); documented additionally: `session.truncation`, `session.compaction_start/complete`, `skill.invoked`, `session.shutdown` (`total_premium_requests`, lines added/removed, files modified), `session.abort`, `exception`.

### Metrics available (native)

| Metric | Type | Notes |
|---|---|---|
| `gen_ai.client.token.usage` | histogram | Native: input/output only, provider `github`; **dropped** in favour of the span-derived one |
| `gen_ai.client.operation.duration` | histogram, s | by operation, provider, model |
| `gen_ai.execute_tool.duration` | histogram, s | JetBrains name |
| `gen_ai.client.operation.time_to_first_chunk`, `.time_per_output_chunk` | histogram, s | documented for CLI |
| `gen_ai.invoke_agent.duration`, `.inference_calls`, `.tool_calls`, `gen_ai.invoke_workflow.duration` | histogram | documented for CLI |
| `github.copilot.tool.call.count` / `.duration` | counter / histogram | by tool |
| `github.copilot.agent.turn.count` | histogram | documented |
| `github.copilot.mcp.server.connection.count` | counter | MCP connection attempts |
| `github.copilot.sandbox.operation.count` | counter | sandbox decisions |
| `github.copilot.code.lines_added` / `.lines_removed` | counter | documented for CLI |
| VS Code only: `copilot_chat.*` (sessions, edit acceptance/survival, user actions and feedback, time to first token, PRs, cloud sessions) | various | legacy namespace |

### Candidate extensions

- Context window fill from `session.usage_info` (gauge `current_tokens / token_limit`).
- Tool-call duration and error rate per tool (spans or native metrics).
- Time to first chunk and server duration per model (latency comparison with OpenCode).
- Premium-request / billing multiplier from `github.copilot.cost` for plan-based accounting.
- Lines added/removed, once the JetBrains export emits them.
- Project label: not available in JetBrains (ADR 0016: default `github-copilot`); VS Code supplies `github.copilot.git.repository`; alternative is mapping `gen_ai.conversation.id` to `cwd` via `~/.copilot/session-state/<id>/workspace.yaml`.

## 3. Cross-source mapping

| Concept | OpenCode | Copilot | Canonical |
|---|---|---|---|
| tokens by type | `message.updated.tokens` | `chat` span usage attrs | `gen_ai.client.token.usage` + `gen_ai.token.type` |
| provider | `providerID` | forced `github-copilot` | `gen_ai.provider.name` |
| model | `modelID` | `gen_ai.request.model` | `gen_ai.request.model` |
| session | `sessionID` | `gen_ai.conversation.id` | `session_id` |
| credits | derived from prices | reported (`nano_aiu`) | `github_copilot_credits_total` (Copilot only) |
| tool calls | `tool` part | `execute_tool` span | not yet canonical |

## Sources

- https://code.visualstudio.com/docs/agents/guides/monitoring-agents
- https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference#opentelemetry-monitoring
- https://docs.github.com/en/enterprise-cloud@latest/copilot/concepts/enterprise/opentelemetry
- `@opencode-ai/sdk` and `@opencode-ai/plugin` type definitions (`types.gen.d.ts`, `index.d.ts`)
