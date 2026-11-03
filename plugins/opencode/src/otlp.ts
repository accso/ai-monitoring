import type { Series } from "./tracker.ts"

export type ResourceInfo = { serviceName: string; instanceId: string }

const attr = (key: string, value: string) => ({ key, value: { stringValue: value } })

/**
 * Cumulative histogram with a single catch-all bucket: _sum is the token total,
 * _count the number of messages. Matches gen_ai.client.token.usage so other
 * GenAI-semconv sources land in the same series.
 */
export function buildOtlpPayload(series: Series[], res: ResourceInfo, t: { startNs: bigint; nowNs: bigint }) {
  return {
    resourceMetrics: [
      {
        resource: { attributes: [attr("service.name", res.serviceName), attr("service.instance.id", res.instanceId)] },
        scopeMetrics: [
          {
            scope: { name: "opencode-ai-monitoring" },
            metrics: [
              {
                name: "gen_ai.client.token.usage",
                unit: "{token}",
                histogram: {
                  aggregationTemporality: 2,
                  dataPoints: series.map((s) => ({
                    startTimeUnixNano: t.startNs.toString(),
                    timeUnixNano: t.nowNs.toString(),
                    count: String(s.count),
                    sum: s.sum,
                    bucketCounts: [String(s.count)],
                    explicitBounds: [] as number[],
                    attributes: [
                      attr("gen_ai.token.type", s.labels.type),
                      attr("gen_ai.provider.name", s.labels.provider),
                      attr("gen_ai.request.model", s.labels.model),
                      attr("gen_ai.agent.name", s.labels.agent),
                      attr("project", s.labels.project),
                      attr("session_id", s.labels.session_id),
                    ],
                  })),
                },
              },
            ],
          },
        ],
      },
    ],
  }
}
