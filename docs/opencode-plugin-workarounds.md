> **OpenCode 1 only.** Everything below describes the V1 plugin API (`@opencode-ai/plugin`) and its internals, and has not been re-verified for OpenCode 2 (new `@opencode/plugin` API, no Bun). See ADR 0018.

# opencode Plugin Workarounds — Reusable Patterns

This is a standalone, copy-pasteable catalogue of everything this project had to work around
in opencode's plugin API, so future plugin projects don't have to re-derive it from scratch.
Every claim below was verified against opencode's actual source (`sst/opencode`, `dev`
branch) during this project — not inferred from docs alone. Where a claim is "confirmed
dead end," it means we traced the real code path and found no route through, so don't spend
time re-investigating it.

This doc is self-contained: every code snippet below is generic and copy-pasteable as-is
into any opencode plugin project — no reference to this source project's file structure is
required to use it. (It originated in `@accso/opencode-ard-plugin`'s `docs/architecture.md`
§10 and `docs/design-decisions.md`, if you want the fuller "why" narrative behind these
findings — but you don't need those files to use anything here.)

## 1. Problem: there is no reliable, cross-frontend way to show plugin status in chat

opencode plugins can run under multiple frontends: opencode's own TUI, and ACP-based clients
(Zed, JetBrains AI Assistant) that talk to opencode over the Agent Client Protocol. Status
mechanisms that work in one do **not** work in the other.

### 1a. `client.tui.showToast(...)` — TUI only, confirmed dead in ACP

```ts
await client.tui.showToast({
  body: { message: "ARD plugin loaded — 3 skill(s), semantic matching ready.", variant: "success" },
});
```

This works great in opencode's own TUI. **It never reaches ACP clients.** Confirmed by
reading opencode's ACP event bridge (`packages/opencode/src/acp/event.ts`): its event switch
only forwards four event types —`session.status`, `permission.asked`,
`message.part.updated`, `message.part.delta`. There is no `tui.toast.show` case. If your
plugin's only status signal is a toast, ACP users will never see it.

### 1b. `client.app.log(...)` — always works, but requires deliberately looking

```ts
await client.app.log({
  body: { service: "my-plugin", level: "info", message: "Plugin loaded successfully." },
});
```

Always succeeds and lands in opencode's log file
(`~/.local/share/opencode/log/opencode.log`), regardless of frontend. Good as a
*secondary*/debuggable channel, but it's not something a user notices without deliberately
tailing the log — not a substitute for an actual notification.

### 1c. Injecting a chat-visible assistant message — confirmed dead end

It's tempting to try creating a message directly via the SDK:

```ts
// DOES NOT WORK for ACP visibility — documented here so you don't retry it.
await client.session.prompt({
  path: { id: sessionId },
  body: { noReply: true, parts: [{ type: "text", text: "Plugin loaded." }] },
});
```

`noReply: true` is real and does create+persist a message without invoking the LLM (confirmed
in `session/prompt.ts`: `if (input.noReply === true) return message`). **But** the message is
built with `role: "user"` (`createUserMessage`), and the ACP bridge's `handlePartDelta`
explicitly early-returns unless `metadata.role === "assistant"`; `handlePartUpdated` ignores
non-tool parts entirely. There is no supported way from a plugin to synthesize an
assistant-authored, ACP-visible chat message. Don't spend time trying variations of this —
we tried role overrides and direct part injection; none reach the ACP chat view.

### 1d. `"permission.ask"` plugin hook — likely never invoked at all

The `Hooks` type (`@opencode-ai/plugin`) documents a `"permission.ask"` hook. We traced the
real permission path exhaustively: `ctx.ask()` (`session/tools.ts`) calls
`Permission.Service.ask()` (`permission/index.ts`) directly — we read that function in full
and found **zero** `plugin.trigger(...)` calls anywhere in it, nor in any other call site we
could find (`session/llm.ts`, `session/processor.ts`, `skill/index.ts`, `plugin/index.ts`,
the HTTP permission route). If your plugin's design depends on an interactive
`"permission.ask"` hook actually firing, verify this against your opencode version first —
in the version we tested against, it's dead code from a plugin author's perspective.

The mechanism that **does** actually enforce anything is
`Permission.evaluate("skill", skill.name, agent.permission).action !== "deny"` in
`skill/index.ts` — this filters which skills are even offered to the model at all. If you
need enforcement, hook into whatever your plugin controls that feeds this evaluation (in our
case, we drive the effective permission set for the turn), not an "ask" prompt.

### 1e. The only thing confirmed to work everywhere: native OS notifications

Spawn a real OS-level notification directly from the plugin process. This entirely bypasses
opencode's hook/event system, so it's frontend-agnostic by construction — it fires whether
you're in the TUI, Zed, or JetBrains AI Assistant.

```ts
// os-notify.ts
import { execFile } from "node:child_process";

export interface OsNotifyRunner {
  run(command: string, args: string[]): void;
}

const defaultRunner: OsNotifyRunner = {
  run(command, args) {
    execFile(command, args, () => {
      /* best-effort: swallow all errors, notifications must never crash the plugin */
    });
  },
};

export function appleScriptString(value: string): string {
  // Escape backslashes and double quotes for embedding inside an AppleScript string literal.
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function notifyOs(
  message: string,
  options: { title?: string; platform?: NodeJS.Platform; runner?: OsNotifyRunner } = {},
): void {
  const platform = options.platform ?? process.platform;
  const runner = options.runner ?? defaultRunner;
  const title = options.title ?? "opencode plugin";

  if (platform === "darwin") {
    const script = `display notification "${appleScriptString(message)}" with title "${appleScriptString(title)}"`;
    runner.run("osascript", ["-e", script]);
    return;
  }

  if (platform === "linux") {
    runner.run("notify-send", [title, message]);
    return;
  }

  // No-op on win32 and anything else — no CLI notifier wired up. Consider node-notifier
  // if you need Windows toast support; we didn't need it for this project.
}
```

Key implementation notes learned the hard way:

- **Inject the runner and platform** (as shown above) so unit tests never spawn real
  processes — see the testing gotcha in §3 below.
- **AppleScript has no icon parameter** for `display notification` at all — if you need a
  custom icon on macOS you must shell out to a third-party tool like `terminal-notifier`
  instead; we deliberately didn't add this (platform asymmetry vs. Linux's `-i` flag wasn't
  worth it for our use case).
- **Linux `notify-send` supports `-i <icon-name-or-path>`** if you do want an icon there.
- **Neither tool supports a progress bar / loading-cycle** for a one-shot notification. If you
  need progress, you'd need a persistent-notification API (e.g. `notify-send -h` hints,
  D-Bus directly) — out of scope for a "fire and forget" status signal.
- **Make it configurable and default-on**, with a boolean escape hatch users can flip off if
  the native popups get noisy:

```yaml
observability:
  os_notifications: true # set false to silence native OS popups; other channels still fire
```

## 2. Problem: opencode invokes plugin bootstrap twice per session

> **Update (2026-10-13):** For ai-monitoring, exporting the plugin as a `PluginModule`
> (`export default { id: "ai-monitoring", server }`, no other exports) removed the need for
> shared, reference-counted state (ADR 0009, superseded). Each `server` call now owns its own
> tracker/exporter, and live verification showed token sums identical to opencode's database
> with a single series per session. The double bootstrap described below was observed with the
> older plain-function export; if you still see it, try the `PluginModule` format first. The
> dedup gate below remains valid for user-visible one-shot side effects if the duplicate
> invocation reappears.

Symptom: a plugin that does something observable on load (log line, OS notification, model
load) does it **twice**, a few hundred ms to ~1s apart, for what the user experiences as a
single new session.

**Confirmed via opencode's own log**: the same `run=<id>` appears twice, each with a complete
independent bootstrap cycle. We ruled out the obvious hypothesis (different `InstanceState`
cache key per call, e.g. different `directory`/`worktree`/`project`) by temporarily logging
those three values from `PluginInput` on both bootstraps — they were **identical** both
times. That means it isn't "two different scopes are each initializing once"; it's the same
scope being initialized twice. Best remaining explanation: a cache-stampede race in
opencode's own `Plugin.Service` `ScopedCache.get` — two near-simultaneous lookups for the same
key both see a miss before the first `init()` call resolves and populates the cache. This is
opencode-side and not fixable from a plugin.

**Workaround: a time-windowed dedup gate** around any user-visible one-shot side effect:

```ts
export interface OsNotifyGate {
  shouldNotify(): boolean;
}

export function createOsNotifyGate(
  options: { windowMs?: number; now?: () => number } = {},
): OsNotifyGate {
  const windowMs = options.windowMs ?? 10_000;
  const now = options.now ?? Date.now;
  let lastFiredAt: number | undefined;

  return {
    shouldNotify(): boolean {
      const t = now();
      if (lastFiredAt !== undefined && t - lastFiredAt < windowMs) return false;
      lastFiredAt = t;
      return true;
    },
  };
}

// module-level singleton — survives across the (likely) two bootstrap calls within one
// plugin process, since they share the same module scope
export const defaultOsNotifyGate = createOsNotifyGate();
```

Wire it in front of the one-shot side effect:

```ts
if (osNotifyGate.shouldNotify()) {
  notifyOs("Plugin loaded successfully.");
}
```

This doesn't fix the double bootstrap (your `init()` logic — model loads, cache warms, etc.
— will still genuinely run twice, which may itself cost you double the startup work); it only
suppresses the duplicate *user-visible* symptom. If your bootstrap work is expensive, consider
also memoizing the actual init logic behind a similar module-level guard (we didn't need this
for a fast-enough startup path, but it's the same pattern).

## 3. Testing gotcha: side-effecting status calls need injectable no-ops in tests

Once you wire a real OS-notification (or any other real subprocess-spawning) call into your
plugin's bootstrap function, **every existing test that exercises that bootstrap function with
default/enabled config will now spawn real `osascript`/`notify-send` processes** as a side
effect of running `bun test` / `npm test`. This is easy to miss because the tests still pass —
they just silently launch extra processes.

Fix: always make the notifier and its gate injectable, and pass an inert gate from tests:

```ts
const noOsNotify: OsNotifyGate = { shouldNotify: () => false };

await bootstrapMyPlugin({
  // ...other test options...
  osNotifyGate: noOsNotify,
});
```

Audit every call site that invokes the bootstrap/init function with a config that has the
notification feature enabled (including default configs!) and inject the inert gate/runner.
This is not optional — treat "spawns real OS processes during `bun test`" as a bug whenever
you add any subprocess-spawning side effect to code under test.

## Quick reference: what to try, in order, for cross-frontend plugin status

1. `client.app.log(...)` — cheap, always works, but nobody's watching the log by default.
2. `client.tui.showToast(...)` — nice UX, but silently invisible under ACP. Fine as a
   secondary channel if you also have #3.
3. Native OS notification (`osascript` / `notify-send`) via a directly-spawned subprocess —
   the only mechanism confirmed to work under every frontend, at the cost of being a native
   popup outside the chat UI itself. Make it configurable and default it as you see fit.
4. Don't bother with: ACP toast forwarding, `noReply` message injection for
   assistant-authored chat visibility, or relying on `"permission.ask"` actually firing —
   all confirmed dead ends against opencode's current implementation. Re-verify against your
   opencode version's source before assuming otherwise; don't just trust the type
   definitions/docs, since `"permission.ask"` is a documented type that turned out to be
   unwired in practice.
