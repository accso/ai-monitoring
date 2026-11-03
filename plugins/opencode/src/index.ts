import { server } from "./v1.ts"
import v2 from "./v2.ts"

/**
 * One artifact for both OpenCode generations (same ~/.config/opencode on one machine):
 * OpenCode 2 reads `id` + `setup()` and ignores `server`; OpenCode 1 (supported: >= 1.19) calls `server()`.
 * The two APIs stay separate; nothing is translated between them.
 */
export default { ...v2, server }
