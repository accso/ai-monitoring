# 0018. One plugin bundle for OpenCode 1 and 2, built without Bun

- Status: Accepted (supersedes 0010 and, for the plugin, 0011)
- Date: 2026-10-28

## Context
OpenCode 2 has a new plugin API (`@opencode/plugin`: `{ id, setup(ctx) }`); V1 plugins (`server()` returning hooks) do not run there. OpenCode 2 no longer runs on Bun. V1 and V2 share `~/.config/opencode`, and V2 auto-loads every top-level `.ts`/`.js` file and plugin directory in `plugins/`, so per-version installs would overwrite each other or load twice (double counting).

## Decision
- One module whose default export is `{ id, setup }` (OpenCode 2) plus `server` (OpenCode 1, minimum supported version 1.19; the object entry itself needs 1.18.29). Each version ignores the other's entry point; the APIs are not translated. Adapters: `src/v2.ts`, `src/v1.ts`; shared core: tracker, exporter, otlp, prometheus, config, project.
- Types only are imported from `@opencode/plugin` and `@opencode-ai/plugin`, so the bundle has no runtime dependencies.
- Build one self-contained `dist/ai-monitoring.js` with esbuild (Node) and install it as `~/.config/opencode/plugins/ai-monitoring.js`. The installer removes a stale `plugins/ai-monitoring/` directory so nothing is discovered twice.
- V2 usage: `session.step.started` (model), `session.step.ended`/`failed` (per-step tokens), `session.compaction.ended`; project from `ctx.location.project.canonical`. V1 usage: cumulative `message.updated` (unchanged).
- Tooling is runtime-neutral: Node + npm, Vitest, tsc, esbuild. mise stays the entry point. Bun stays only for `pricing/`.

## Consequences
- Works on a machine with either or both OpenCode versions; no version detection in the installer.
- V2 payloads come from `@opencode/schema@2.2.0` types and are not yet verified in a live V2 session; V1 verified live against 1.19.4.
- V2 has no plugin logger and does not forward console output to `opencode.log`; V2 warnings go to `ai-monitoring.log` beside it (verified live).
- Title-generation usage is not exposed by public V2 events and is not counted there.
- Drop `src/v1.ts` and the `server` export when V1 support ends.

## Alternatives considered
- V2 only — leaves V1 users without monitoring.
- Separate V1/V2 installers or directory layouts — conflict in the shared config directory and risk double loading.
- Shipping TypeScript source without a bundle — leaves a plugin directory that must not coexist with a V1 file.
