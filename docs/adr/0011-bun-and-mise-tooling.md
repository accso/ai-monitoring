# 0011. Bun and mise as tooling

- Status: Superseded by [0018](0018-one-plugin-bundle-for-opencode-1-and-2.md) for the plugin (Bun remains for `pricing/`; mise remains the entry point)
- Date: 2026-10-13

## Context
opencode runs plugins on Bun. The repo needs one entry point for starting the stack and building/testing/installing the plugin.

## Decision
Use Bun (pinned in `mise.toml`) for the plugin: runtime, `bun test`, `bun build`. Use mise tasks as the only documented entry point (`mise run up`, `plugin:test`, `plugin:install`, …). Shell scripts in `scripts/` hold non-trivial logic and are called by mise tasks.

## Consequences
- Reproducible toolchain; same runtime as opencode.
- Contributors need mise (and Docker for the stack).

## Alternatives considered
- npm/node + Makefile — different runtime than production, extra tooling.
