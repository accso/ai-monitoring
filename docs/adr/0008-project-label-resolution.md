# 0008. Resolution order for the `project` label

- Status: Accepted
- Date: 2026-10-13

## Context
Dashboards group usage per project; the plugin must label every series reliably.

## Decision
Resolve in this order: env `AI_MONITORING_PROJECT` → plugin option `project` → git repo name (basename of opencode's `worktree`) → basename of `directory` → `unknown`. Blank values are ignored.

## Consequences
- Predictable default without configuration; override possible per shell or plugin config.
- Monorepos share one label unless overridden.

## Alternatives considered
- Full path — leaks usernames and is not portable between machines.
- Manual only — unlabelled data when forgotten.
