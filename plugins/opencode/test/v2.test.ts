import { afterEach, expect, test } from "vitest"
import plugin from "../src/v2.ts"

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.AI_MONITORING_PROJECT
})

const tokens = (input: number) => ({ input, output: 1, reasoning: 0, cache: { read: 2, write: 3 } })
let n = 0
const ev = (type: string, data: Record<string, unknown>) => ({ id: `evt_${++n}`, type, data })
const started = (msg: string) =>
  ev("session.step.started", { sessionID: "s1", assistantMessageID: msg, agent: "build", model: { providerID: "github-copilot", id: "gpt-x" }, started: 0 })
const ended = (msg: string, input: number) =>
  ev("session.step.ended", { sessionID: "s1", assistantMessageID: msg, finish: "stop", cost: 0, tokens: tokens(input) })

/** Fake plugin context whose event stream is fed by the test. */
const boot = async (events: unknown[] = [], options: Record<string, unknown> = {}) => {
  let wake: (() => void) | undefined
  const queue = [...events]
  const subscribed: any[] = []
  const ctx = {
    options,
    location: { directory: "/x/y", project: { id: "p", directory: "/x/y", canonical: "/x" } },
    event: {
      subscribe: (opts: { signal?: AbortSignal; types?: string[] }) => {
        subscribed.push(opts)
        return (async function* () {
          while (!opts.signal?.aborted) {
            if (queue.length) yield queue.shift()
            else await new Promise<void>((r) => ((wake = r), opts.signal?.addEventListener("abort", () => r())))
          }
        })()
      },
    },
  }
  const cleanup = (await plugin.setup(ctx as any)) as () => Promise<void>
  const push = async (e: unknown) => {
    queue.push(e)
    wake?.()
    await new Promise((r) => setTimeout(r, 10))
  }
  await new Promise((r) => setTimeout(r, 10))
  return { cleanup, push, subscribed }
}

const capture = () => {
  const bodies: any[] = []
  globalThis.fetch = (async (_u: any, init: any) => {
    bodies.push(JSON.parse(init.body))
    return new Response("{}", { status: 200 })
  }) as any
  return bodies
}
const points = (body: any) => body.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram.dataPoints
const byType = (dps: any[], type: string) =>
  dps.find((d) => d.attributes.some((a: any) => a.key === "gen_ai.token.type" && a.value.stringValue === type))

test("default export is a V2 plugin definition", () => {
  expect(plugin.id).toBe("ai-monitoring")
  expect(typeof plugin.setup).toBe("function")
})

test("subscribes only to the usage events", async () => {
  capture()
  const { cleanup, subscribed } = await boot()
  expect(subscribed[0].types).toEqual(["session.step.started", "session.step.ended", "session.step.failed", "session.compaction.ended"])
  await cleanup()
})

test("step usage is attributed to the model from step.started, flushed on cleanup", async () => {
  process.env.AI_MONITORING_PROJECT = "wired"
  const bodies = capture()
  const { cleanup, push } = await boot()
  await push(started("m1"))
  await push(ended("m1", 10))
  await push(started("m2"))
  await push(ended("m2", 5))
  await cleanup()

  expect(bodies).toHaveLength(1)
  const dps = points(bodies[0])
  expect(dps).toHaveLength(4)
  expect(byType(dps, "input").sum).toBe(15)
  expect(byType(dps, "input").attributes).toContainEqual({ key: "gen_ai.agent.name", value: { stringValue: "build" } })
  expect(byType(dps, "input").attributes).toContainEqual({ key: "project", value: { stringValue: "wired" } })
  expect(byType(dps, "input").attributes).toContainEqual({ key: "gen_ai.request.model", value: { stringValue: "gpt-x" } })
})

test("project defaults to the canonical project directory name", async () => {
  const bodies = capture()
  const { cleanup, push } = await boot([started("m1"), ended("m1", 1)])
  await push(ended("m1", 1))
  await cleanup()
  expect(byType(points(bodies[0]), "input").attributes).toContainEqual({ key: "project", value: { stringValue: "x" } })
})

test("cleanup is idempotent and exports once", async () => {
  const bodies = capture()
  const { cleanup, push } = await boot()
  await push(started("m1"))
  await push(ended("m1", 10))
  await cleanup()
  await cleanup()
  expect(bodies).toHaveLength(1)
})

test("compaction usage is counted with its own model", async () => {
  const bodies = capture()
  const { cleanup, push } = await boot()
  await push(ev("session.compaction.ended", { sessionID: "s1", model: { providerID: "anthropic", id: "c" }, tokens: tokens(7) }))
  await cleanup()
  expect(byType(points(bodies[0]), "input").sum).toBe(7)
})

test("a step without a known model is recorded as unknown", async () => {
  const bodies = capture()
  const { cleanup, push } = await boot()
  await push(ended("never-started", 4))
  await cleanup()
  expect(byType(points(bodies[0]), "input").attributes).toContainEqual({ key: "gen_ai.request.model", value: { stringValue: "unknown" } })
})

test("an export failure is written to ai-monitoring.log beside the opencode log", async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = mkdtempSync(join(tmpdir(), "aimon-"))
  process.env.XDG_DATA_HOME = dir
  globalThis.fetch = (async () => {
    throw new Error("connect ECONNREFUSED")
  }) as any
  const { cleanup, push } = await boot()
  await push(started("m1"))
  await push(ended("m1", 1))
  await cleanup()
  const text = readFileSync(join(dir, "opencode", "log", "ai-monitoring.log"), "utf8")
  expect(text).toMatch(/WARN ai-monitoring export failed \(otlp\): connect ECONNREFUSED/)
  delete process.env.XDG_DATA_HOME
  rmSync(dir, { recursive: true, force: true })
})
