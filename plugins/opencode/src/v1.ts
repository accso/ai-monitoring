import type { Plugin } from "@opencode-ai/plugin"
import { resolveConfig } from "./config.ts"
import { Exporter } from "./exporter.ts"
import { resolveProject } from "./project.ts"
import { TokenTracker } from "./tracker.ts"

const SERVICE = "ai-monitoring"

/**
 * OpenCode 1 adapter. V1 fires message.updated many times per assistant message with
 * cumulative token totals; the tracker turns that into deltas.
 */
export const server: Plugin = async (input, options = {}) => {
  const config = resolveConfig(process.env, options)
  const project = resolveProject({
    env: process.env,
    option: typeof options.project === "string" ? options.project : undefined,
    worktree: input.worktree,
    directory: input.directory,
  })
  const tracker = new TokenTracker(project)
  const exporter = new Exporter(config, tracker, {
    log: (message) => void input.client.app.log({ body: { service: SERVICE, level: "warn", message } }).catch(() => {}),
  })
  exporter.start()
  let disposed = false

  return {
    event: async ({ event }) => {
      if (event.type === "message.updated") {
        const info = event.properties.info
        if (info.role === "assistant") {
          const m = info as typeof info & { agent?: string; mode?: string }
          tracker.record({ ...info, agent: m.agent ?? m.mode })
        }
      } else if (event.type === "message.removed") {
        tracker.forget(event.properties.messageID)
      }
    },
    dispose: async () => {
      if (disposed) return
      disposed = true
      await exporter.stop()
    },
  }
}
