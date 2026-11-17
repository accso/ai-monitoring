import type { Config } from "./config.ts"
import { buildOtlpPayload } from "./otlp.ts"
import { buildPrometheusText } from "./prometheus.ts"
import { keyOf, type Series, type TokenTracker } from "./tracker.ts"

type Deps = {
  fetch?: typeof fetch
  instanceId?: string
  log?: (message: string) => void
}

export class Exporter {
  private readonly fetchFn: typeof fetch
  private readonly instanceId: string
  private readonly log: (message: string) => void
  private readonly startNs = BigInt(Date.now()) * 1_000_000n
  private timer: ReturnType<typeof setInterval> | undefined
  private inflight: Promise<void> = Promise.resolve()
  private failing = false
  private readonly baselined = new Set<string>()

  constructor(
    private readonly cfg: Config,
    private readonly tracker: TokenTracker,
    deps: Deps = {},
  ) {
    this.fetchFn = deps.fetch ?? fetch
    this.instanceId = deps.instanceId ?? crypto.randomUUID()
    this.log = deps.log ?? (() => {})
  }

  start(): void {
    this.timer = setInterval(() => void this.flush(), this.cfg.flushIntervalMs)
    this.timer.unref?.()
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    await this.flush()
  }

  /** Serialised so overlapping flushes cannot reorder cumulative values. Never throws. */
  flush(): Promise<void> {
    this.inflight = this.inflight.then(() => this.doFlush())
    return this.inflight
  }

  /**
   * VictoriaMetrics' increase() does not count the first sample of a new counter series when it is
   * large, which silently drops most cache_write/input tokens (they arrive in a message's first update).
   * A new series therefore starts with a 0 sample 1 ms before its first real value.
   */
  private async doFlush(): Promise<void> {
    const series = this.tracker.drainDirty()
    if (series.length === 0) return
    const res = { serviceName: this.cfg.serviceName, instanceId: this.instanceId }
    const now = Date.now()
    const fresh = series.filter((s) => !this.baselined.has(keyOf(s.labels))).map((s) => ({ ...s, sum: 0, count: 0 }))
    try {
      if (this.cfg.transport === "direct") {
        await this.send(`${this.cfg.victoriaMetricsUrl}/api/v1/import/prometheus`, "text/plain", buildPrometheusText(fresh, res, now - 1) + buildPrometheusText(series, res, now))
      } else {
        const url = `${this.cfg.otlpEndpoint}/v1/metrics`
        const body = (batch: Series[], ms: number) =>
          JSON.stringify(buildOtlpPayload(batch, res, { startNs: this.startNs, nowNs: BigInt(ms) * 1_000_000n }))
        if (fresh.length > 0) await this.send(url, "application/json", body(fresh, now - 1))
        await this.send(url, "application/json", body(series, now))
      }
      for (const s of series) this.baselined.add(keyOf(s.labels))
      this.failing = false
    } catch (err) {
      this.tracker.requeue(series)
      if (!this.failing) this.log(`ai-monitoring export failed (${this.cfg.transport}): ${err instanceof Error ? err.message : String(err)}`)
      this.failing = true
    }
  }

  private async send(url: string, contentType: string, body: string): Promise<void> {
    const response = await this.fetchFn(url, { method: "POST", headers: { "content-type": contentType }, body })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  }
}
