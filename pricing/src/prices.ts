export type ModelsDev = Record<string, { models?: Record<string, { cost?: Record<string, number> }> }>

export type TokenType = "input" | "output" | "cache_read" | "cache_write" | "reasoning"

export interface PriceRow {
  provider: string
  model: string
  type: TokenType
  usd: number
  credits?: number
}

export interface Override {
  provider: string
  model: string
  input?: number
  output?: number
  cache_read?: number
  cache_write?: number
  reasoning?: number
  credits?: Partial<Record<TokenType, number>>
  /** Price valid from this instant on (ISO date/datetime, UTC when no zone). Omitted = always valid. */
  from?: string | Date
}

/** 1 GitHub AI credit = $0.01 (ADR 0014). */
const CREDITS_PER_USD = 100
const CREDIT_PROVIDERS = new Set(["github-copilot"])
const TYPES: TokenType[] = ["input", "output", "cache_read", "cache_write", "reasoning"]

const toCredits = (provider: string, usd: number) =>
  CREDIT_PROVIDERS.has(provider) ? Math.round(usd * CREDITS_PER_USD * 1e6) / 1e6 : undefined

function rowsFor(provider: string, model: string, cost: Partial<Record<TokenType, number>>): PriceRow[] {
  const full = { ...cost, reasoning: cost.reasoning ?? cost.output }
  const rows: PriceRow[] = []
  for (const type of TYPES) {
    const usd = full[type]
    if (typeof usd !== "number") continue
    const credits = toCredits(provider, usd)
    rows.push(credits === undefined ? { provider, model, type, usd } : { provider, model, type, usd, credits })
  }
  return rows
}

export function buildRows(api: ModelsDev, providers: string[]): PriceRow[] {
  const rows: PriceRow[] = []
  for (const provider of providers) {
    for (const [model, def] of Object.entries(api[provider]?.models ?? {})) {
      if (def.cost) rows.push(...rowsFor(provider, model, def.cost))
    }
  }
  return rows
}

export function applyOverrides(rows: PriceRow[], overrides: Override[]): PriceRow[] {
  const key = (r: Pick<PriceRow, "provider" | "model" | "type">) => `${r.provider}\u0000${r.model}\u0000${r.type}`
  const map = new Map(rows.map((r) => [key(r), r]))
  for (const o of overrides) {
    const cost: Partial<Record<TokenType, number>> = {}
    for (const t of TYPES) if (typeof o[t] === "number") cost[t] = o[t]
    if (cost.reasoning === undefined && cost.output !== undefined) cost.reasoning = cost.output
    for (const row of rowsFor(o.provider, o.model, cost)) {
      const explicit = o.credits?.[row.type]
      map.set(key(row), explicit === undefined ? row : { ...row, credits: explicit })
    }
  }
  return [...map.values()]
}

export const fromMs = (o: Override): number | undefined => {
  if (o.from === undefined || o.from === null) return undefined
  const ms = o.from instanceof Date ? o.from.getTime() : Date.parse(String(o.from))
  if (Number.isNaN(ms)) throw new Error(`invalid "from" in override ${o.provider}/${o.model}: ${o.from}`)
  return ms
}

const modelKey = (o: Pick<Override, "provider" | "model">) => `${o.provider}\u0000${o.model}`

/** Overrides valid at `at`: undated ones always, per model only the latest dated one whose `from` has passed. */
export function activeOverrides(overrides: Override[], at: number): Override[] {
  const undated = overrides.filter((o) => fromMs(o) === undefined)
  const latest = new Map<string, Override>()
  for (const o of overrides) {
    const f = fromMs(o)
    if (f === undefined || f > at) continue
    const cur = latest.get(modelKey(o))
    if (!cur || fromMs(cur)! <= f) latest.set(modelKey(o), o)
  }
  return [...undated, ...latest.values()]
}

/**
 * Historic gauge samples for models with dated overrides: one sample per `stepMs` grid point
 * (so re-running is idempotent) from each `from` until the next one or `now`, at most `maxDays` back.
 * Yields prometheus text chunks of at most `chunkSamples` timestamps.
 */
export function* backfill(
  api: ModelsDev,
  providers: string[],
  overrides: Override[],
  now: number,
  render: (rows: PriceRow[], ts: number) => string,
  opts: { stepMs?: number; maxDays?: number; chunkSamples?: number } = {},
): Generator<string> {
  const step = opts.stepMs ?? 240_000
  const floor = now - (opts.maxDays ?? 90) * 86_400_000
  const chunk = opts.chunkSamples ?? 2000
  const base = buildRows(api, providers)
  const dated = new Map<string, Override[]>()
  for (const o of overrides) if (fromMs(o) !== undefined) dated.set(modelKey(o), [...(dated.get(modelKey(o)) ?? []), o])
  for (const list of dated.values()) {
    list.sort((a, b) => fromMs(a)! - fromMs(b)!)
    const { provider, model } = list[0]!
    const modelBase = base.filter((r) => r.provider === provider && r.model === model)
    const undated = overrides.filter((o) => fromMs(o) === undefined && o.provider === provider && o.model === model)
    for (let i = 0; i < list.length; i++) {
      const start = Math.max(fromMs(list[i]!)!, floor)
      const end = Math.min(i + 1 < list.length ? fromMs(list[i + 1]!)! : now, now)
      const rows = applyOverrides(modelBase, [...undated, list[i]!])
      let text = ""
      let n = 0
      for (let ts = Math.ceil(start / step) * step; ts < end; ts += step) {
        text += render(rows, ts)
        if (++n >= chunk) {
          yield text
          text = ""
          n = 0
        }
      }
      if (text) yield text
    }
  }
}
