import type { Plugin } from "@opencode/plugin"
import { resolveConfig } from "./config.ts"
import { Exporter } from "./exporter.ts"
import { warn } from "./log.ts"
import { resolveProject } from "./project.ts"
import { TokenTracker, type AssistantUsage } from "./tracker.ts"

const ID = "ai-monitoring"
const MAX_OPEN_STEPS = 1000

const TYPES = ["session.step.started", "session.step.ended", "session.step.failed", "session.compaction.ended"] as const

type ModelRef = { providerID: string; id: string }
type StepInfo = { model: ModelRef; agent?: string }
type Tokens = AssistantUsage["tokens"]

/**
 * Minimal structural view of the V2 events this plugin consumes
 * (`@opencode/schema` session-event: Step.Started/Ended/Failed, Compaction.Ended).
 * Every event carries its own unique id, which is used for de-duplication.
 */
type UsageEvent = { id: string; type: (typeof TYPES)[number]; data: Record<string, any> }

const plugin: Plugin.Plugin = {
  id: ID,
  setup(ctx) {
    const config = resolveConfig(process.env, ctx.options)
    const project = resolveProject({
      env: process.env,
      option: typeof ctx.options.project === "string" ? ctx.options.project : undefined,
      worktree: ctx.location.project.canonical,
      directory: ctx.location.directory,
    })
    const tracker = new TokenTracker(project)
    const exporter = new Exporter(config, tracker, { log: (message) => warn(message) })
    exporter.start()

    // Step.Ended does not repeat the model, so remember it from Step.Started.
    const models = new Map<string, StepInfo>()
    const record = (event: UsageEvent, model: ModelRef | undefined, agent: string | undefined, tokens: Tokens | undefined) => {
      if (!tokens) return
      tracker.record({
        id: event.id,
        sessionID: String(event.data.sessionID),
        providerID: model?.providerID ?? "unknown",
        modelID: model?.id ?? "unknown",
        agent,
        tokens,
      })
    }

    const handle = (event: UsageEvent) => {
      const d = event.data
      switch (event.type) {
        case "session.step.started":
          models.delete(d.assistantMessageID)
          models.set(d.assistantMessageID, { model: d.model, agent: d.agent })
          while (models.size > MAX_OPEN_STEPS) models.delete(models.keys().next().value!)
          break
        case "session.step.ended":
        case "session.step.failed": {
          const step = models.get(d.assistantMessageID)
          record(event, step?.model, step?.agent, d.tokens)
          models.delete(d.assistantMessageID)
          break
        }
        case "session.compaction.ended":
          record(event, d.model, d.agent ?? "compaction", d.tokens)
          break
      }
    }

    const controller = new AbortController()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ types: [...TYPES], signal: controller.signal })) {
          handle(event as unknown as UsageEvent)
        }
      } catch (err) {
        if (!controller.signal.aborted) warn(`event stream stopped: ${err instanceof Error ? err.message : String(err)}`)
      }
    })()

    let stopped = false
    return async () => {
      if (stopped) return
      stopped = true
      controller.abort()
      await exporter.stop()
    }
  },
}

export default plugin
