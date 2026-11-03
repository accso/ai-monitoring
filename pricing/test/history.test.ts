import { describe, expect, test } from "bun:test"
import { activeOverrides, backfill, type ModelsDev } from "../src/prices.ts"
import { renderPrometheus } from "../src/render.ts"
import { syncOnce } from "../src/sync.ts"

const api: ModelsDev = { anthropic: { models: { m: { cost: { input: 3, output: 15 } } } } }
const day = 86_400_000
const t0 = Date.parse("2026-09-01")
const ov = [
  { provider: "anthropic", model: "m", from: "2026-09-01", input: 2, output: 10 },
  { provider: "anthropic", model: "m", from: "2026-09-02", input: 3, output: 15 },
]

describe("activeOverrides", () => {
  test("picks the latest dated entry that has started", () => {
    expect(activeOverrides(ov, t0 - 1)).toEqual([])
    expect(activeOverrides(ov, t0 + 1)[0]!.input).toBe(2)
    expect(activeOverrides(ov, t0 + day)[0]!.input).toBe(3)
  })
  test("undated overrides always apply", () => {
    expect(activeOverrides([{ provider: "a", model: "x", input: 1 }], 0)).toHaveLength(1)
  })
  test("rejects an invalid date", () => {
    expect(() => activeOverrides([{ provider: "a", model: "x", from: "nope" }], 0)).toThrow()
  })
})

describe("backfill", () => {
  test("writes each period with its own price on an aligned grid", () => {
    const text = [...backfill(api, ["anthropic"], ov, t0 + 2 * day, renderPrometheus, { stepMs: 3_600_000 })].join("")
    const at = (ts: number) => text.split("\n").find((l) => l.includes('token_type="input"') && l.endsWith(` ${ts}`))
    expect(at(t0 + 3_600_000)).toContain("} 2 ")
    expect(at(t0 + day + 3_600_000)).toContain("} 3 ")
    expect(text).not.toContain(` ${t0 + 2 * day}\n`)
  })
  test("respects maxDays", () => {
    const text = [...backfill(api, ["anthropic"], ov, t0 + 2 * day, renderPrometheus, { stepMs: 3_600_000, maxDays: 1 })].join("")
    expect(text).not.toContain(` ${t0 + 3_600_000}\n`)
  })
})

describe("syncOnce with backfill", () => {
  test("backfills once per overrides content and pushes the current price", async () => {
    const pushed: string[] = []
    const state = { maxDays: 90 } as { done?: string; maxDays: number }
    const deps = { providers: ["anthropic"], overrides: ov, fetchApi: async () => api, push: async (t: string) => void pushed.push(t), now: () => t0 + 2 * day, backfill: state }
    await syncOnce(deps)
    const first = pushed.length
    expect(first).toBeGreaterThan(1)
    expect(pushed.at(-1)).toContain(`gen_ai_token_type="input"} 3 ${t0 + 2 * day}`)
    await syncOnce(deps)
    expect(pushed.length).toBe(first + 1)
  })
})
