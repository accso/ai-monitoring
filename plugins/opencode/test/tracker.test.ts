import { describe, expect, test } from "vitest"
import { TokenTracker, type AssistantUsage } from "../src/tracker.ts"

const msg = (over: Partial<AssistantUsage> = {}): AssistantUsage => ({
  id: "m1",
  sessionID: "s1",
  providerID: "anthropic",
  modelID: "claude-sonnet",
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  ...over,
})
const tokens = (input: number, output: number, read = 0, write = 0, reasoning = 0) => ({
  input,
  output,
  reasoning,
  cache: { read, write },
})
const sumOf = (t: TokenTracker, type: string) =>
  t.drainDirty().find((s) => s.labels.type === type)

describe("TokenTracker", () => {
  test("records all token types with labels", () => {
    const t = new TokenTracker("proj")
    t.record(msg({ tokens: tokens(10, 20, 30, 40, 5) }))
    const series = t.drainDirty()
    expect(series.map((s) => [s.labels.type, s.sum]).sort()).toEqual([
      ["cache_read", 30],
      ["cache_write", 40],
      ["input", 10],
      ["output", 20],
      ["reasoning", 5],
    ])
    expect(series[0]!.labels).toMatchObject({
      provider: "anthropic",
      model: "claude-sonnet",
      agent: "unknown",
      project: "proj",
      session_id: "s1",
    })
  })

  test("series are split per agent", () => {
    const t = new TokenTracker("p")
    t.record(msg({ id: "a", agent: "build", tokens: tokens(10, 5) }))
    t.record(msg({ id: "b", agent: "explore", tokens: tokens(4, 1) }))
    const agents = new Set(t.drainDirty().map((s) => s.labels.agent))
    expect(agents).toEqual(new Set(["build", "explore"]))
  })

  test("repeated updates of one message only add the delta", () => {
    const t = new TokenTracker("p")
    t.record(msg({ tokens: tokens(10, 5) }))
    t.record(msg({ tokens: tokens(10, 5) }))
    t.record(msg({ tokens: tokens(10, 25) }))
    t.drainDirty()
    t.record(msg({ tokens: tokens(10, 25) }))
    expect(t.drainDirty()).toEqual([])
    t.record(msg({ tokens: tokens(10, 30) }))
    expect(sumOf(t, "output")!.sum).toBe(30)
  })

  test("count increments once per message and type", () => {
    const t = new TokenTracker("p")
    t.record(msg({ tokens: tokens(1, 0) }))
    t.record(msg({ tokens: tokens(5, 0) }))
    t.record(msg({ id: "m2", tokens: tokens(2, 0) }))
    const input = sumOf(t, "input")!
    expect(input.sum).toBe(7)
    expect(input.count).toBe(2)
  })

  test("decreasing totals are ignored", () => {
    const t = new TokenTracker("p")
    t.record(msg({ tokens: tokens(10, 0) }))
    t.record(msg({ tokens: tokens(4, 0) }))
    t.record(msg({ tokens: tokens(12, 0) }))
    expect(sumOf(t, "input")!.sum).toBe(12)
  })

  test("zero tokens produce no series", () => {
    const t = new TokenTracker("p")
    t.record(msg())
    expect(t.drainDirty()).toEqual([])
  })

  test("sums accumulate across messages sharing labels, split otherwise", () => {
    const t = new TokenTracker("p")
    t.record(msg({ id: "a", tokens: tokens(1, 0) }))
    t.record(msg({ id: "b", tokens: tokens(2, 0) }))
    t.record(msg({ id: "c", modelID: "other", tokens: tokens(4, 0) }))
    const input = t.drainDirty().filter((s) => s.labels.type === "input")
    expect(input.map((s) => [s.labels.model, s.sum]).sort()).toEqual([
      ["claude-sonnet", 3],
      ["other", 4],
    ])
  })

  test("drainDirty keeps cumulative totals and only returns changed series", () => {
    const t = new TokenTracker("p")
    t.record(msg({ tokens: tokens(1, 1) }))
    t.drainDirty()
    t.record(msg({ id: "m2", tokens: tokens(2, 0) }))
    const drained = t.drainDirty()
    expect(drained).toHaveLength(1)
    expect(drained[0]!.sum).toBe(3)
  })

  test("requeue marks drained series dirty again", () => {
    const t = new TokenTracker("p")
    t.record(msg({ tokens: tokens(1, 0) }))
    const drained = t.drainDirty()
    t.requeue(drained)
    expect(t.drainDirty()).toHaveLength(1)
  })

  test("forget drops message state and bounds memory", () => {
    const t = new TokenTracker("p", { maxMessages: 2 })
    t.record(msg({ id: "a", tokens: tokens(1, 0) }))
    t.record(msg({ id: "b", tokens: tokens(1, 0) }))
    t.record(msg({ id: "c", tokens: tokens(1, 0) }))
    expect(t.trackedMessages()).toBe(2)
    t.forget("b")
    expect(t.trackedMessages()).toBe(1)
  })
})
