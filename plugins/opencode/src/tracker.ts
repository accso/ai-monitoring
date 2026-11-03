export type TokenType = "input" | "output" | "reasoning" | "cache_read" | "cache_write"

export type AssistantUsage = {
  id: string
  sessionID: string
  providerID: string
  modelID: string
  /** Agent name (build, plan, explore, ...); absent on old OpenCode builds. */
  agent?: string
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
}

export type SeriesLabels = {
  type: TokenType
  provider: string
  model: string
  agent: string
  project: string
  session_id: string
}

export type Series = { labels: SeriesLabels; sum: number; count: number }

type Totals = Record<TokenType, number>

const flatten = (t: AssistantUsage["tokens"]): Totals => ({
  input: t.input ?? 0,
  output: t.output ?? 0,
  reasoning: t.reasoning ?? 0,
  cache_read: t.cache?.read ?? 0,
  cache_write: t.cache?.write ?? 0,
})

const TYPES: TokenType[] = ["input", "output", "reasoning", "cache_read", "cache_write"]

/**
 * OpenCode reports cumulative token totals per assistant message and fires
 * message.updated many times while streaming. This turns those into
 * cumulative per-series sums by only adding the delta since the last update.
 */
export class TokenTracker {
  private seen = new Map<string, Totals>()
  private series = new Map<string, Series>()
  private dirty = new Set<string>()
  private readonly maxMessages: number

  constructor(
    private readonly project: string,
    opts: { maxMessages?: number } = {},
  ) {
    this.maxMessages = opts.maxMessages ?? 5000
  }

  record(m: AssistantUsage): void {
    const next = flatten(m.tokens)
    const prev = this.seen.get(m.id)
    const merged = {} as Totals
    for (const type of TYPES) {
      const before = prev?.[type] ?? 0
      const after = Math.max(before, next[type])
      merged[type] = after
      const delta = after - before
      if (delta <= 0) continue
      const s = this.seriesFor({
        type,
        provider: m.providerID,
        model: m.modelID,
        agent: m.agent || "unknown",
        project: this.project,
        session_id: m.sessionID,
      })
      s.sum += delta
      if (before === 0) s.count += 1
    }
    this.seen.delete(m.id)
    this.seen.set(m.id, merged)
    while (this.seen.size > this.maxMessages) {
      this.seen.delete(this.seen.keys().next().value!)
    }
  }

  forget(messageId: string): void {
    this.seen.delete(messageId)
  }

  trackedMessages(): number {
    return this.seen.size
  }

  drainDirty(): Series[] {
    const out = [...this.dirty].map((k) => ({ ...this.series.get(k)!, labels: { ...this.series.get(k)!.labels } }))
    this.dirty.clear()
    return out
  }

  requeue(drained: Series[]): void {
    for (const s of drained) this.dirty.add(keyOf(s.labels))
  }

  private seriesFor(labels: SeriesLabels): Series {
    const key = keyOf(labels)
    let s = this.series.get(key)
    if (!s) {
      s = { labels, sum: 0, count: 0 }
      this.series.set(key, s)
    }
    this.dirty.add(key)
    return s
  }
}

const keyOf = (l: SeriesLabels) => [l.type, l.provider, l.model, l.agent, l.project, l.session_id].join("\u0000")
