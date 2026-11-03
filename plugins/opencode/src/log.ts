import { appendFileSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

/** Same directory as opencode.log (XDG data dir). */
export function logFile(env: Record<string, string | undefined> = process.env): string {
  return join(env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "opencode", "log", "ai-monitoring.log")
}

/**
 * OpenCode 2 gives plugins no logger and does not forward console output to opencode.log,
 * so warnings go to console and to a file beside the opencode log. Never throws.
 */
export function warn(message: string, env: Record<string, string | undefined> = process.env): void {
  console.warn(`[ai-monitoring] ${message}`)
  try {
    const file = logFile(env)
    mkdirSync(dirname(file), { recursive: true })
    appendFileSync(file, `${new Date().toISOString()} WARN ${message}\n`)
  } catch {
    /* logging must never break the plugin */
  }
}
