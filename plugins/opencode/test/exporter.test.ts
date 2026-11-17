import { expect, test } from "vitest"
import { resolveConfig } from "../src/config.ts"
import { Exporter } from "../src/exporter.ts"
import { TokenTracker } from "../src/tracker.ts"

const usage = (id: string, input: number) => ({
  id,
  sessionID: "s",
  providerID: "p",
  modelID: "m",
  tokens: { input, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
})

test("config defaults and env overrides", () => {
  expect(resolveConfig({}, {})).toMatchObject({
    transport: "otlp",
    otlpEndpoint: "http://127.0.0.1:4318",
    victoriaMetricsUrl: "http://127.0.0.1:8428",
    flushIntervalMs: 5000,
    serviceName: "opencode",
  })
  const c = resolveConfig({ AI_MONITORING_TRANSPORT: "direct", AI_MONITORING_FLUSH_MS: "250" }, { serviceName: "x" })
  expect(c).toMatchObject({ transport: "direct", flushIntervalMs: 250, serviceName: "x" })
  expect(resolveConfig({ AI_MONITORING_TRANSPORT: "bogus" }, {}).transport).toBe("otlp")
})

test("otlp flush posts to /v1/metrics and clears dirty state", async () => {
  const calls: { url: string; body: string; type: string }[] = []
  const fetchFn = async (url: any, init: any) => {
    calls.push({ url: String(url), body: init.body, type: init.headers["content-type"] })
    return new Response("{}", { status: 200 })
  }
  const tracker = new TokenTracker("proj")
  const cfg = resolveConfig({}, {})
  const ex = new Exporter(cfg, tracker, { fetch: fetchFn as any, instanceId: "i" })
  tracker.record(usage("a", 5))
  await ex.flush()
  expect(calls).toHaveLength(2)
  expect(calls[1]!.url).toBe("http://127.0.0.1:4318/v1/metrics")
  expect(calls[1]!.type).toBe("application/json")
  await ex.flush()
  expect(calls).toHaveLength(2)
})

test("direct flush posts prometheus text to the import endpoint", async () => {
  const calls: { url: string; body: string }[] = []
  const fetchFn = async (url: any, init: any) => {
    calls.push({ url: String(url), body: init.body })
    return new Response(null, { status: 204 })
  }
  const tracker = new TokenTracker("proj")
  const ex = new Exporter(resolveConfig({ AI_MONITORING_TRANSPORT: "direct" }, {}), tracker, { fetch: fetchFn as any, instanceId: "i" })
  tracker.record(usage("a", 5))
  await ex.flush()
  expect(calls[0]!.url).toBe("http://127.0.0.1:8428/api/v1/import/prometheus")
  expect(calls[0]!.body).toContain("gen_ai_client_token_usage_sum{")
})

test("failed flush keeps data for the next attempt and never throws", async () => {
  let fail = true
  const errors: string[] = []
  const fetchFn = async () => (fail ? Promise.reject(new Error("down")) : new Response("{}", { status: 200 }))
  const tracker = new TokenTracker("proj")
  const ex = new Exporter(resolveConfig({}, {}), tracker, {
    fetch: fetchFn as any,
    instanceId: "i",
    log: (m) => errors.push(m),
  })
  tracker.record(usage("a", 5))
  await ex.flush()
  expect(errors.length).toBe(1)
  fail = false
  await ex.flush()
  expect(tracker.drainDirty()).toEqual([])
})

test("http error status counts as failure", async () => {
  const tracker = new TokenTracker("proj")
  const errors: string[] = []
  const ex = new Exporter(resolveConfig({}, {}), tracker, {
    fetch: (async () => new Response("no", { status: 500 })) as any,
    instanceId: "i",
    log: (m) => errors.push(m),
  })
  tracker.record(usage("a", 5))
  await ex.flush()
  expect(errors.length).toBe(1)
  expect(tracker.drainDirty()).toHaveLength(1)
})

test("repeated failures are logged once until an export succeeds", async () => {
  const tracker = new TokenTracker("proj")
  const errors: string[] = []
  const ex = new Exporter(resolveConfig({}, {}), tracker, {
    fetch: (async () => new Response("no", { status: 500 })) as any,
    instanceId: "i",
    log: (m) => errors.push(m),
  })
  tracker.record(usage("a", 5))
  await ex.flush()
  await ex.flush()
  await ex.flush()
  expect(errors.length).toBe(1)
})

const dps = (body: string) => JSON.parse(body).resourceMetrics[0].scopeMetrics[0].metrics[0].histogram.dataPoints

test("a new series is first exported as a zero baseline so increase() counts its first value", async () => {
  const bodies: string[] = []
  const fetchFn = async (_u: any, init: any) => {
    bodies.push(init.body)
    return new Response("{}", { status: 200 })
  }
  const tracker = new TokenTracker("proj")
  const ex = new Exporter(resolveConfig({}, {}), tracker, { fetch: fetchFn as any, instanceId: "i" })
  tracker.record(usage("a", 5))
  await ex.flush()
  expect(bodies).toHaveLength(2)
  const [base, real] = [dps(bodies[0]!), dps(bodies[1]!)]
  expect(base).toHaveLength(1)
  expect(base[0].sum).toBe(0)
  expect(base[0].count).toBe("0")
  expect(real[0].sum).toBe(5)
  expect(BigInt(base[0].timeUnixNano)).toBeLessThan(BigInt(real[0].timeUnixNano))

  tracker.record(usage("a", 9))
  await ex.flush()
  expect(bodies).toHaveLength(3)
  expect(dps(bodies[2]!)[0].sum).toBe(9)
})

test("direct transport writes the baseline with an earlier timestamp in the same body", async () => {
  const bodies: string[] = []
  const fetchFn = async (_u: any, init: any) => {
    bodies.push(init.body)
    return new Response(null, { status: 204 })
  }
  const tracker = new TokenTracker("proj")
  const ex = new Exporter(resolveConfig({ AI_MONITORING_TRANSPORT: "direct" }, {}), tracker, { fetch: fetchFn as any, instanceId: "i" })
  tracker.record(usage("a", 5))
  await ex.flush()
  expect(bodies).toHaveLength(1)
  const sums = bodies[0]!.split("\n").filter((l) => l.startsWith("gen_ai_client_token_usage_sum"))
  const parse = (l: string) => l.replace(/^.*\} /, "").split(" ").map(Number) as [number, number]
  const [a, b] = sums.map(parse)
  expect(a![0]).toBe(0)
  expect(b![0]).toBe(5)
  expect(a![1]).toBeLessThan(b![1])
})
