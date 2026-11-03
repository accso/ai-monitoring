import { expect, test } from "vitest"
import { resolveProject } from "../src/project.ts"

const base = { env: {}, option: undefined, worktree: "/work/my-repo", directory: "/work/my-repo/sub" }

test("env wins", () => {
  expect(resolveProject({ ...base, env: { AI_MONITORING_PROJECT: "from-env" }, option: "opt" })).toBe("from-env")
})
test("plugin option next", () => {
  expect(resolveProject({ ...base, option: "opt" })).toBe("opt")
})
test("git repo name (worktree basename)", () => {
  expect(resolveProject(base)).toBe("my-repo")
})
test("falls back to cwd basename when not a git repo", () => {
  expect(resolveProject({ ...base, worktree: "/" })).toBe("sub")
  expect(resolveProject({ ...base, worktree: "" })).toBe("sub")
})
test("blank env/option are ignored", () => {
  expect(resolveProject({ ...base, env: { AI_MONITORING_PROJECT: "  " }, option: "" })).toBe("my-repo")
})
test("unknown when nothing resolvable", () => {
  expect(resolveProject({ env: {}, option: undefined, worktree: "/", directory: "/" })).toBe("unknown")
})
