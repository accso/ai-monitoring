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
  expect(calls).toHaveLength(1)
  expect(calls[0]!.url).toBe("http://127.0.0.1:4318/v1/metrics")
  expect(calls[0]!.type).toBe("application/json")
  await ex.flush()
  expect(calls).toHaveLength(1)
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
