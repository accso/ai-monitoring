import { describe, expect, test } from "bun:test"
import { applyOverrides, buildRows, type ModelsDev } from "../src/prices.ts"
import { renderPrometheus } from "../src/render.ts"

const api: ModelsDev = {
  "github-copilot": {
    models: {
      "claude-sonnet-5.5": { cost: { input: 2, output: 10, cache_read: 0.1, cache_write: 2.5 } },
      "kimi-k3": { cost: { input: 3, output: 15, cache_read: 0.3 } },
      free: {},
    },
  },
  anthropic: { models: { "claude-haiku-4-5": { cost: { input: 1, output: 5, cache_read: 0.1, cache_write: 1.25 } } } },
  other: { models: { x: { cost: { input: 9, output: 9 } } } },
}

const find = (rows: ReturnType<typeof buildRows>, p: string, m: string, t: string) =>
  rows.find((r) => r.provider === p && r.model === m && r.type === t)

describe("buildRows", () => {
  const rows = buildRows(api, ["github-copilot", "anthropic"])

  test("maps models.dev cost fields to token types", () => {
    expect(find(rows, "github-copilot", "claude-sonnet-5.5", "input")?.usd).toBe(2)
    expect(find(rows, "github-copilot", "claude-sonnet-5.5", "output")?.usd).toBe(10)
    expect(find(rows, "github-copilot", "claude-sonnet-5.5", "cache_read")?.usd).toBe(0.1)
    expect(find(rows, "github-copilot", "claude-sonnet-5.5", "cache_write")?.usd).toBe(2.5)
  })

  test("reasoning is priced like output", () => {
    expect(find(rows, "github-copilot", "claude-sonnet-5.5", "reasoning")?.usd).toBe(10)
  })

  test("credits are USD x 100 for github-copilot only", () => {
    expect(find(rows, "github-copilot", "claude-sonnet-5.5", "input")?.credits).toBe(200)
    expect(find(rows, "github-copilot", "claude-sonnet-5.5", "cache_read")?.credits).toBe(10)
    expect(find(rows, "anthropic", "claude-haiku-4-5", "input")?.credits).toBeUndefined()
  })

  test("skips missing token types, models without cost and other providers", () => {
    expect(find(rows, "github-copilot", "kimi-k3", "cache_write")).toBeUndefined()
    expect(rows.some((r) => r.model === "free")).toBe(false)
    expect(rows.some((r) => r.provider === "other")).toBe(false)
  })
})

describe("applyOverrides", () => {
  const base = buildRows(api, ["github-copilot"])

  test("overrides an existing price and recomputes credits", () => {
    const rows = applyOverrides(base, [{ provider: "github-copilot", model: "kimi-k3", input: 4 }])
    const r = find(rows, "github-copilot", "kimi-k3", "input")
    expect(r?.usd).toBe(4)
    expect(r?.credits).toBe(400)
  })

  test("adds rows for unknown models, with explicit credits winning", () => {
    const rows = applyOverrides(base, [
      { provider: "github-copilot", model: "new-model", input: 1, output: 2, credits: { input: 123 } },
    ])
    expect(find(rows, "github-copilot", "new-model", "output")?.usd).toBe(2)
    expect(find(rows, "github-copilot", "new-model", "reasoning")?.usd).toBe(2)
    expect(find(rows, "github-copilot", "new-model", "input")?.credits).toBe(123)
  })
})

describe("renderPrometheus", () => {
  test("emits price and credit gauges with the join labels", () => {
    const text = renderPrometheus(buildRows(api, ["github-copilot"]), 1000)
    expect(text).toContain(
      'model_price_usd_per_mtok{gen_ai_provider_name="github-copilot",gen_ai_request_model="claude-sonnet-5.5",gen_ai_token_type="input"} 2 1000',
    )
    expect(text).toContain(
      'model_credits_per_mtok{gen_ai_provider_name="github-copilot",gen_ai_request_model="claude-sonnet-5.5",gen_ai_token_type="input"} 200 1000',
    )
  })

  test("escapes label values", () => {
    const text = renderPrometheus([{ provider: "p", model: 'a"b', type: "input", usd: 1 }], 1)
    expect(text).toContain('gen_ai_request_model="a\\"b"')
  })
})
