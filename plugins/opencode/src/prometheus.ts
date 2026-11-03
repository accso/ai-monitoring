import type { ResourceInfo } from "./otlp.ts"
import type { Series } from "./tracker.ts"

const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")

/** Same metric and label names VictoriaMetrics derives from the OTLP path (-opentelemetry.usePrometheusNaming). */
export function buildPrometheusText(series: Series[], res: ResourceInfo, tsMs: number): string {
  const lines: string[] = []
  for (const s of series) {
    const labels = [
      ["gen_ai_token_type", s.labels.type],
      ["gen_ai_provider_name", s.labels.provider],
      ["gen_ai_request_model", s.labels.model],
      ["gen_ai_agent_name", s.labels.agent],
      ["project", s.labels.project],
      ["session_id", s.labels.session_id],
      ["service_name", res.serviceName],
      ["service_instance_id", res.instanceId],
    ]
      .map(([k, v]) => `${k}="${esc(v!)}"`)
      .join(",")
    lines.push(`gen_ai_client_token_usage_sum{${labels}} ${s.sum} ${tsMs}`)
    lines.push(`gen_ai_client_token_usage_count{${labels}} ${s.count} ${tsMs}`)
  }
  return lines.join("\n") + "\n"
}
