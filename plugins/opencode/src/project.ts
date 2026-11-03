import { basename } from "node:path"

export type ProjectInput = {
  env: Record<string, string | undefined>
  option: string | undefined
  worktree: string
  directory: string
}

const clean = (v: string | undefined) => (v ?? "").trim()

const nameOf = (p: string) => {
  const trimmed = p.replace(/\/+$/, "")
  return trimmed ? basename(trimmed) : ""
}

/** env AI_MONITORING_PROJECT -> plugin option -> git repo name -> cwd basename. */
export function resolveProject(i: ProjectInput): string {
  return (
    clean(i.env.AI_MONITORING_PROJECT) ||
    clean(i.option) ||
    nameOf(i.worktree) ||
    nameOf(i.directory) ||
    "unknown"
  )
}
