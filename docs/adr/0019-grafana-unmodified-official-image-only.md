# 0019. Grafana: unmodified official image only

- Status: Accepted
- Date: 2026-11-03

## Context

Grafana is licensed under AGPL-3.0, while this repository is Apache-2.0. The stack visualises metrics
with Grafana, started through `compose.yaml`. We must avoid becoming a distributor or modifier of
AGPL code.

## Decision

The repository only references the official `grafana/grafana` image in `compose.yaml`. The user's Docker
pulls it from upstream. We keep it unmodified and limit our involvement to configuration:
environment variables, provisioning YAML and our own dashboard JSON.

Rules for contributors:

- Use only the official `grafana/grafana` image, pinned to a version. No custom Dockerfile, patched build or fork.
- Do not push the image to our own registry and do not bake it into installers or VM images.
- Do not add Grafana source or binaries to the repository.
- Check the licence before adding any Grafana plugin or enterprise feature.
- Hosting the stack for third parties is only acceptable with an unmodified Grafana.

## Consequences

- No Grafana code is distributed by us, so the AGPL obligations stay with upstream.
- We cannot patch Grafana. Customisation must go through configuration, dashboards or provisioning.
- Licences are documented in [THIRD-PARTY-LICENSES.md](../../THIRD-PARTY-LICENSES.md).

## Alternatives considered

- Bring-your-own Grafana (remove it from compose) — more setup effort for users and a weaker out-of-the-box experience.
- VictoriaMetrics vmui only — no dashboards.
