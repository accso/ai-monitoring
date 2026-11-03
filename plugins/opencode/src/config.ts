export type Config = {
  transport: "otlp" | "direct"
  otlpEndpoint: string
  victoriaMetricsUrl: string
  flushIntervalMs: number
  serviceName: string
}

type Env = Record<string, string | undefined>
type Options = Record<string, unknown>

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)

/** Env wins over plugin options, which win over defaults. */
export function resolveConfig(env: Env, options: Options): Config {
  const transport = str(env.AI_MONITORING_TRANSPORT) ?? str(options.transport)
  const flush = Number(str(env.AI_MONITORING_FLUSH_MS) ?? options.flushIntervalMs)
  return {
    transport: transport === "direct" ? "direct" : "otlp",
    otlpEndpoint: (str(env.AI_MONITORING_OTLP_ENDPOINT) ?? str(options.otlpEndpoint) ?? "http://127.0.0.1:4318").replace(/\/+$/, ""),
    victoriaMetricsUrl: (str(env.AI_MONITORING_VM_URL) ?? str(options.victoriaMetricsUrl) ?? "http://127.0.0.1:8428").replace(/\/+$/, ""),
    flushIntervalMs: Number.isFinite(flush) && flush > 0 ? flush : 5000,
    serviceName: str(env.AI_MONITORING_SERVICE_NAME) ?? str(options.serviceName) ?? "opencode",
  }
}
