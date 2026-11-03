import { expect, test } from "vitest"
import * as mod from "../src/index.ts"

test("module has only a default export carrying both the V2 and V1 entry points", () => {
  expect(Object.keys(mod)).toEqual(["default"])
  expect(mod.default.id).toBe("ai-monitoring")
  expect(typeof mod.default.setup).toBe("function") // OpenCode 2
  expect(typeof mod.default.server).toBe("function") // OpenCode 1
})
