---
name: plugin-release
description: >
  Use when releasing, installing, updating or rolling back the OpenCode
  ai-monitoring plugin (plugins/opencode): version bump, changelog, tests,
  build, install into ~/.config/opencode/plugins, verification and tagging.
  Drives scripts/install-plugin.sh and the mise plugin:* tasks.
---

# OpenCode plugin release flow

Details and rationale: `docs/releasing.md`, `docs/plugin.md`, ADR 0010. Never skip a step; stop and report on the first failure.

1. **Plan first.** Ask which bump level applies (patch/minor/major) and summarise the changes since the last release. Wait for confirmation.
2. **Preconditions.** Run `mise run status`; if the stack is down, run `mise run up` so integration tests are not skipped.
3. **Test.** `mise run plugin:test` must pass (typecheck + unit + integration). For behaviour changes confirm the test was observed failing before the fix (see `.github/instructions/ai-context-tdd.instructions.md` for the red/green discipline).
4. **Version and changelog.** Set the new version in `plugins/opencode/package.json` and add an entry at the top of `plugins/opencode/CHANGELOG.md`. If a significant decision was made, add an ADR in `docs/adr/` and update its index.
5. **Install.** Run `scripts/install-plugin.sh` (or `mise run plugin:install`). It runs typecheck and tests (Vitest on Node), bundles with esbuild, verifies the bundle default-exports only `{ id, setup, server }`, and copies it atomically to `~/.config/opencode/plugins/ai-monitoring.js` (removing a stale `ai-monitoring/` directory). Use `--dry-run` to rehearse and `--target DIR` for another location. Never use `--skip-tests` for a release.
6. **Verify live.** Tell the user to start a new opencode session and send a prompt (the plugin loads per session). Then check:
   - `curl -s 'http://127.0.0.1:8428/api/v1/query?query=gen_ai_client_token_usage_sum'` returns series for the expected provider/model/project;
   - `grep ai-monitoring ~/.local/share/opencode/log/opencode.log` shows no export warnings.
   Do not claim success until data is seen.
7. **Commit and tag.** If the directory is a git repository: commit with the Co-authored-by trailer, tag `plugin-vX.Y.Z`. Otherwise say that no tag was created.

**Rollback:** `git checkout plugin-v<previous>` then `scripts/install-plugin.sh`, or `scripts/install-plugin.sh --uninstall`.

**Pitfalls:** one bundle for OpenCode 1 + 2 (default export `{ id, setup, server }`, ADR 0018); never install a second copy or a plugin directory next to `ai-monitoring.js` (double loading counts twice); one tracker/exporter per call, flushed on cleanup/dispose; V2 has no plugin logger and console output is not forwarded, so V2 warnings go to `~/.local/share/opencode/log/ai-monitoring.log`, V1 uses `client.app.log` (opencode.log); re-verify token sums vs. the opencode DB after changes, on V1 and V2.
