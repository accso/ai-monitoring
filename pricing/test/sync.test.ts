import { describe, expect, test } from "bun:test"
import { loadOverrides, syncOnce } from "../src/sync.ts"

const api = { "github-copilot": { models: { m: { cost: { input: 1, output: 2 } } } } }

describe("syncOnce", () => {
  test("fetches, applies overrides and pushes prometheus text", async () => {
    const pushed: string[] = []
    await syncOnce({
      providers: ["github-copilot"],
      overrides: [{ provider: "github-copilot", model: "m", output: 5 }],
      fetchApi: async () => api,
      push: async (t) => void pushed.push(t),
      now: () => 42,
    })
    expect(pushed[0]).toContain('gen_ai_token_type="output"} 5 42')
    expect(pushed[0]).toContain('gen_ai_token_type="input"} 1 42')
  })

  test("reuses the cached API response until it expires", async () => {
    let calls = 0
    const deps = {
      providers: ["github-copilot"],
      overrides: [],
      fetchApi: async () => (calls++, api),
      push: async () => {},
      now: () => 1,
    }
    const cache = { data: undefined as undefined | typeof api, at: 0 }
    await syncOnce({ ...deps, cache, ttlMs: 1000 })
    await syncOnce({ ...deps, cache, ttlMs: 1000, now: () => 500 })
    expect(calls).toBe(1)
    await syncOnce({ ...deps, cache, ttlMs: 1000, now: () => 2000 })
    expect(calls).toBe(2)
  })

  test("keeps pushing from cache when a refresh fails", async () => {
    const cache = { data: api as typeof api | undefined, at: 0 }
    const pushed: string[] = []
    await syncOnce({
      providers: ["github-copilot"],
      overrides: [],
      fetchApi: async () => {
        throw new Error("offline")
      },
      push: async (t) => void pushed.push(t),
      now: () => 5000,
      cache,
      ttlMs: 1000,
    })
    expect(pushed.length).toBe(1)
  })
})

describe("loadOverrides", () => {
  test("parses yaml and tolerates a missing file", async () => {
    const f = `${import.meta.dir}/tmp-overrides.yaml`
    await Bun.write(f, "overrides:\n  - provider: p\n    model: m\n    input: 1\n")
    expect(await loadOverrides(f)).toEqual([{ provider: "p", model: "m", input: 1 }])
    expect(await loadOverrides(`${import.meta.dir}/nope.yaml`)).toEqual([])
    await Bun.file(f).delete()
  })
})
