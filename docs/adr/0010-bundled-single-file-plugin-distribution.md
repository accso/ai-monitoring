# 0010. Distribute the plugin as one bundled file in the global plugins dir

- Status: Superseded by [0018](0018-one-plugin-bundle-for-opencode-1-and-2.md)
- Date: 2026-10-13

## Context
opencode loads local plugins from `~/.config/opencode/plugins/` (global) or `.opencode/plugins/` (project). Local plugins need their dependencies installed in the config dir. The existing plugin there is also shipped as a single bundled `.js`. The plugin itself has no runtime dependencies.

## Decision
Build with `bun build --target=bun` into `dist/ai-monitoring.js` and install it into `~/.config/opencode/plugins/` via `scripts/install-plugin.sh`. Export the plugin function as named and default export, matching the existing plugin. Monitoring should cover all projects, hence global installation.

## Consequences
- No dependency installation in the opencode config dir; trivial uninstall (delete one file).
- Updates apply on the next opencode session; no auto-update.
- Releases are driven by the `plugin-release` skill.

## Alternatives considered
- Publish to npm and reference in `opencode.json` — needs a registry/publishing setup; revisit if the plugin is shared outside the team.
- Project-level `.opencode/plugins/` — covers only one repo.
