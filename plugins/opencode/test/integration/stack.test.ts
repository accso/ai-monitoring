import { afterAll, describe, expect, test } from "vitest"
import { resolveConfig } from "../../src/config.ts"
import { Exporter } from "../../src/exporter.ts"
import { TokenTracker } from "../../src/tracker.ts"

const VM = "http://127.0.0.1:8428"
const up = await fetch(`${VM}/health`).then((r) => r.ok).catch(() => false)
const run = `it-${Date.now()}`

const query = async (q: string) => {
  const r = await fetch(`${VM}/api/v1/query?query=${encodeURIComponent(q)}`)
  return (await r.json()).data.result as { metric: Record<string, string>; value: [number, string] }[]
}
const waitFor = async (q: string, n: number) => {
  for (let i = 0; i < 40; i++) {
    const r = await query(q)
    if (r.length >= n) return r
    await new Promise((r) => setTimeout(r, 500))
  }
  return query(q)
}

describe.skipIf(!up)("live stack (requires `mise run up`)", () => {
  afterAll(async () => {
    await fetch(`${VM}/api/v1/admin/tsdb/delete_series?match[]=${encodeURIComponent(`{project=~"${run}.*"}`)}`, { method: "POST" })
  })

  for (const transport of ["otlp", "direct"] as const) {
    test(`${transport} transport lands identical series in VictoriaMetrics`, async () => {
      const project = `${run}-${transport}`
      const tracker = new TokenTracker(project)
      const ex = new Exporter(resolveConfig({ AI_MONITORING_TRANSPORT: transport }, {}), tracker)
      tracker.record({
        id: "m1",
        sessionID: "s1",
        providerID: "anthropic",
        modelID: "claude-test",
        agent: "build",
        tokens: { input: 100, output: 20, reasoning: 0, cache: { read: 300, write: 40 } },
      })
      await ex.flush()
      const rows = await waitFor(`gen_ai_client_token_usage_sum{project="${project}"}`, 4)
      const byType = Object.fromEntries(rows.map((r) => [r.metric.gen_ai_token_type, Number(r.value[1])]))
      expect(byType).toEqual({ input: 100, output: 20, cache_read: 300, cache_write: 40 })
      expect(rows[0]!.metric).toMatchObject({
        gen_ai_provider_name: "anthropic",
        gen_ai_request_model: "claude-test",
        gen_ai_agent_name: "build",
        session_id: "s1",
        service_name: "opencode",
      })
      expect(rows[0]!.metric.service_instance_id).toBeTruthy()
    }, 30000)
  }
})
