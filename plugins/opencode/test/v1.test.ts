import { afterEach, expect, test } from "vitest"
import { server } from "../src/v1.ts"

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.AI_MONITORING_PROJECT
})

const assistant = (id: string, input: number) => ({
  type: "message.updated",
  properties: {
    info: {
      id,
      sessionID: "s1",
      role: "assistant",
      providerID: "github-copilot",
      modelID: "gpt-x",
      mode: "plan",
      tokens: { input, output: 1, reasoning: 0, cache: { read: 2, write: 3 } },
    },
  },
})

const boot = () =>
  server({ client: { app: { log: async () => ({}) } }, directory: "/x/y", worktree: "/x" } as any)

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

test("assistant updates are summed per message, user messages ignored, flushed on dispose", async () => {
  process.env.AI_MONITORING_PROJECT = "wired"
  const bodies = capture()
  const hooks = await boot()
  await hooks.event!({ event: assistant("m1", 10) as any })
  await hooks.event!({ event: assistant("m1", 15) as any })
  await hooks.event!({ event: { type: "message.updated", properties: { info: { id: "u", role: "user" } } } as any })
  await hooks.dispose!()

  expect(bodies).toHaveLength(1)
  const dps = points(bodies[0])
  expect(dps).toHaveLength(4)
  expect(byType(dps, "input").sum).toBe(15)
  expect(byType(dps, "input").attributes).toContainEqual({ key: "gen_ai.agent.name", value: { stringValue: "plan" } })
  expect(byType(dps, "input").attributes).toContainEqual({ key: "project", value: { stringValue: "wired" } })
})

test("dispose is idempotent and exports once", async () => {
  const bodies = capture()
  const a = await boot()
  await a.event!({ event: assistant("m1", 10) as any })
  await a.dispose!()
  await a.dispose!()
  expect(bodies).toHaveLength(1)
})

test("a fresh bootstrap after full dispose starts clean", async () => {
  const bodies = capture()
  const a = await boot()
  await a.event!({ event: assistant("m1", 10) as any })
  await a.dispose!()
  const b = await boot()
  await b.event!({ event: assistant("m2", 3) as any })
  await b.dispose!()
  expect(bodies).toHaveLength(2)
  expect(byType(points(bodies[1]), "input").sum).toBe(3)
})
