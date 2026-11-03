import { expect, test } from "vitest"
import { buildOtlpPayload } from "../src/otlp.ts"
import { buildPrometheusText } from "../src/prometheus.ts"
import type { Series } from "../src/tracker.ts"

const series: Series[] = [
  {
    labels: { type: "input", provider: "anthropic", model: "claude", agent: "build", project: "proj", session_id: "s1" },
    sum: 150,
    count: 2,
  },
]
const resource = { serviceName: "opencode", instanceId: "inst-1" }

test("otlp payload is a cumulative single-bucket histogram with semconv attributes", () => {
  const p = buildOtlpPayload(series, resource, { startNs: 1000n, nowNs: 2000n })
  const rm = p.resourceMetrics[0]!
  expect(rm.resource.attributes).toContainEqual({ key: "service.name", value: { stringValue: "opencode" } })
  expect(rm.resource.attributes).toContainEqual({ key: "service.instance.id", value: { stringValue: "inst-1" } })
  const m = rm.scopeMetrics[0]!.metrics[0]!
  expect(m.name).toBe("gen_ai.client.token.usage")
  expect(m.unit).toBe("{token}")
  expect(m.histogram.aggregationTemporality).toBe(2)
  const dp = m.histogram.dataPoints[0]!
  expect(dp).toMatchObject({ count: "2", sum: 150, bucketCounts: ["2"], explicitBounds: [], startTimeUnixNano: "1000", timeUnixNano: "2000" })
  const attrs = Object.fromEntries(dp.attributes.map((a) => [a.key, a.value.stringValue]))
  expect(attrs).toEqual({
    "gen_ai.token.type": "input",
    "gen_ai.provider.name": "anthropic",
    "gen_ai.request.model": "claude",
    "gen_ai.agent.name": "build",
    project: "proj",
    session_id: "s1",
  })
})

test("prometheus text uses the same names VictoriaMetrics derives from OTLP", () => {
  const text = buildPrometheusText(series, resource, 1700000000000)
  const labels =
    'gen_ai_token_type="input",gen_ai_provider_name="anthropic",gen_ai_request_model="claude",gen_ai_agent_name="build",project="proj",session_id="s1",service_name="opencode",service_instance_id="inst-1"'
  expect(text).toContain(`gen_ai_client_token_usage_sum{${labels}} 150 1700000000000`)
  expect(text).toContain(`gen_ai_client_token_usage_count{${labels}} 2 1700000000000`)
})

test("prometheus label values are escaped", () => {
  const s: Series[] = [{ ...series[0]!, labels: { ...series[0]!.labels, project: 'a"b\\c\nd' } }]
  expect(buildPrometheusText(s, resource, 1)).toContain('project="a\\"b\\\\c\\nd"')
})
