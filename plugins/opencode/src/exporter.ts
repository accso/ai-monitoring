import type { Config } from "./config.ts"
import { buildOtlpPayload } from "./otlp.ts"
import { buildPrometheusText } from "./prometheus.ts"
import type { TokenTracker } from "./tracker.ts"

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

  private async doFlush(): Promise<void> {
    const series = this.tracker.drainDirty()
    if (series.length === 0) return
    const res = { serviceName: this.cfg.serviceName, instanceId: this.instanceId }
    const now = Date.now()
    try {
      const response =
        this.cfg.transport === "direct"
          ? await this.fetchFn(`${this.cfg.victoriaMetricsUrl}/api/v1/import/prometheus`, {
              method: "POST",
              headers: { "content-type": "text/plain" },
              body: buildPrometheusText(series, res, now),
            })
          : await this.fetchFn(`${this.cfg.otlpEndpoint}/v1/metrics`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(buildOtlpPayload(series, res, { startNs: this.startNs, nowNs: BigInt(now) * 1_000_000n })),
            })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      this.failing = false
    } catch (err) {
      this.tracker.requeue(series)
      if (!this.failing) this.log(`ai-monitoring export failed (${this.cfg.transport}): ${err instanceof Error ? err.message : String(err)}`)
      this.failing = true
    }
  }
}
