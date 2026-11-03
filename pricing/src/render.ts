import type { PriceRow } from "./prices.ts"

const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")

/** Prometheus text for /api/v1/import/prometheus. Labels match the token series so dashboards can join on them. */
export function renderPrometheus(rows: PriceRow[], tsMs: number): string {
  const lines: string[] = []
  for (const r of rows) {
    const labels = `gen_ai_provider_name="${esc(r.provider)}",gen_ai_request_model="${esc(r.model)}",gen_ai_token_type="${r.type}"`
    lines.push(`model_price_usd_per_mtok{${labels}} ${r.usd} ${tsMs}`)
    if (r.credits !== undefined) lines.push(`model_credits_per_mtok{${labels}} ${r.credits} ${tsMs}`)
  }
  return lines.join("\n") + "\n"
}
