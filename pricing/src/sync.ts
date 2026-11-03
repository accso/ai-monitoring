import { activeOverrides, applyOverrides, backfill, buildRows, type ModelsDev, type Override, type PriceRow } from "./prices.ts"
import { renderPrometheus } from "./render.ts"

export interface Cache {
  data?: ModelsDev
  at: number
}

export interface SyncDeps {
  providers: string[]
  overrides: Override[]
  fetchApi: () => Promise<ModelsDev>
  push: (prometheusText: string) => Promise<void>
  now?: () => number
  cache?: Cache
  ttlMs?: number
  /** Backfill historic prices of dated overrides once per distinct overrides content. */
  backfill?: { done?: string; maxDays?: number }
}

/** One cycle: refresh models.dev when the cache is stale (keeping stale data on failure), apply overrides, push gauges. */
export async function syncOnce(d: SyncDeps): Promise<PriceRow[]> {
  const now = (d.now ?? Date.now)()
  const cache = d.cache ?? { at: 0 }
  if (!cache.data || now - cache.at >= (d.ttlMs ?? 0)) {
    try {
      cache.data = await d.fetchApi()
      cache.at = now
    } catch (err) {
      if (!cache.data) throw err
      console.error(`models.dev refresh failed, using cached prices: ${err}`)
    }
  }
  if (d.backfill) {
    const sig = JSON.stringify([d.providers, d.overrides])
    if (d.backfill.done !== sig) {
      for (const text of backfill(cache.data!, d.providers, d.overrides, now, renderPrometheus, { maxDays: d.backfill.maxDays })) await d.push(text)
      d.backfill.done = sig
    }
  }
  const rows = applyOverrides(buildRows(cache.data!, d.providers), activeOverrides(d.overrides, now))
  await d.push(renderPrometheus(rows, now))
  return rows
}

export async function loadOverrides(path: string): Promise<Override[]> {
  const file = Bun.file(path)
  if (!(await file.exists())) return []
  const doc = Bun.YAML.parse(await file.text()) as { overrides?: Override[] } | null
  return doc?.overrides ?? []
}
