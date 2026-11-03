import { loadOverrides, syncOnce, type Cache } from "./sync.ts"

const env = (k: string, d: string) => process.env[k] || d
const vm = env("VM_URL", "http://127.0.0.1:8428")
const providers = env("PRICING_PROVIDERS", "github-copilot,anthropic,openai").split(",").map((s) => s.trim())
const source = env("PRICING_SOURCE_URL", "https://models.dev/api.json")
const overridesPath = env("PRICING_OVERRIDES", `${import.meta.dir}/../overrides.yaml`)
const pushEveryMs = Number(env("PRICING_PUSH_INTERVAL_SECONDS", "30")) * 1000
const refreshMs = Number(env("PRICING_REFRESH_HOURS", "6")) * 3_600_000
const loop = process.argv.includes("--loop")

const cache: Cache = { at: 0 }
const backfillState = { maxDays: Number(env("PRICING_BACKFILL_DAYS", "90")) }

async function cycle() {
  const rows = await syncOnce({
    providers,
    overrides: await loadOverrides(overridesPath),
    fetchApi: async () => {
      const res = await fetch(source)
      if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`)
      return (await res.json()) as never
    },
    push: async (text) => {
      const res = await fetch(`${vm}/api/v1/import/prometheus`, { method: "POST", body: text })
      if (!res.ok) throw new Error(`VictoriaMetrics import: HTTP ${res.status}`)
    },
    cache,
    ttlMs: refreshMs,
    backfill: backfillState,
  })
  return rows.length
}

if (!loop) {
  console.log(`pushed ${await cycle()} price rows for ${providers.join(", ")}`)
} else {
  console.log(`pricing-sync: providers=${providers.join(",")} push every ${pushEveryMs / 1000}s, refresh every ${refreshMs / 3_600_000}h`)
  while (true) {
    try {
      await cycle()
    } catch (err) {
      console.error(`sync failed: ${err}`)
    }
    await Bun.sleep(pushEveryMs)
  }
}
