# Releasing the OpenCode plugin

The release flow is automated by the skill `.github/skills/plugin-release/SKILL.md` and by `scripts/install-plugin.sh`. Versioning: semver in `plugins/opencode/package.json`; changes are noted in `plugins/opencode/CHANGELOG.md`; git tags (if the repo is under git) are `plugin-vX.Y.Z`.

Checklist:

1. Stack up (`mise run up`) so integration tests run.
2. `mise run plugin:test` is green.
3. Bump version and add a CHANGELOG entry.
4. `mise run plugin:install` (typecheck, tests, esbuild bundle, bundle verification, atomic copy).
5. Start a new opencode session, send a prompt, and verify the series in VictoriaMetrics and no `ai-monitoring` warnings in the opencode log.
6. Commit and tag.

Rollback: check out the previous tag and run `mise run plugin:install`, or `mise run plugin:uninstall`.
