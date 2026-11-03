# Source: GitHub Copilot (JetBrains IDE)

## IDE settings

Enable OpenTelemetry export, exporter `otlp-http`, protocol `http/json`, endpoint `http://localhost:4318`, service name `github-copilot`. Leave prompt/response capture and the output file off. **Restart the IDE after applying** — a new chat session is not enough.

## What Copilot sends (verified 2026-10-13, plugin on IntelliJ 2026.2)

- **Traces** (`chat <model>` spans) with `gen_ai.usage.input_tokens` (includes cache read and write), `output_tokens`, `cache_read.input_tokens`, `cache_write.input_tokens`, `gen_ai.request.model`, `gen_ai.conversation.id`, `github.copilot.cost` and `github.copilot.nano_aiu`.
- **Metrics**: `gen_ai.client.token.usage` (only input/output, provider `github`, no cache types), operation and tool durations, tool-call counts. All cumulative.
- No `project` attribute; the IDE exports no per-project resource attributes.

## Normalisation (collector/config.yaml, ADR 0016)

1. `transform/copilot` sets `gen_ai.provider.name=github-copilot` and `session_id` on spans.
2. `signal_to_metrics/copilot` derives `gen_ai.client.token.usage` per type from chat spans: `input` = input − cache read − cache write, plus `output`, `cache_read`, `cache_write`. Spans without usage attributes are skipped. `delta_to_cumulative` turns the result into cumulative series, identical in shape to the OpenCode plugin's.
3. Copilot's own token metric is dropped to avoid double counting.
4. `github.copilot.credits` (counter) = `nano_aiu / 1e9`, the credits Copilot itself reports per call.

## Verified

For one call (input 188136 incl. cache, cache read 186560, cache write 1572, output 354, Sonnet 5.5) `nano_aiu` = 2 613 400 000, i.e. 2.6134 credits. The model price list (ADR 0014: 2/10/0.1/2.5 USD per 1M tokens, credits = USD × 100) gives exactly 2.6134. This confirms the pricing formula and gives a ground truth to compare the dashboard against.

## Known gaps

- No project info in JetBrains. `project` defaults to `github-copilot` (collector `resource/copilot-project`, inserted only if the source does not set one). Alternatives are listed in `docs/metrics-catalog.md`.
- Copilot omits usage attributes whose value is zero; the collector defaults `cache_read`, `cache_write` and `output` to 0 on chat spans that have `input_tokens`. Before this fix (until 2026-10-13 12:55) such calls were missing on the token side but counted in credits.
