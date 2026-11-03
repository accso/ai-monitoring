#!/usr/bin/env bash
# Build, verify and install the OpenCode ai-monitoring plugin (one bundle for OpenCode 1 and 2).
#
# Usage: scripts/install-plugin.sh [--target DIR] [--skip-tests] [--dry-run] [--uninstall]
#   --target DIR   plugins directory (default: $OPENCODE_CONFIG_DIR or ~/.config/opencode, + /plugins)
#   --skip-tests   skip typecheck and unit tests (not for releases)
#   --dry-run      build and verify, but do not copy anything into the target
#   --uninstall    remove the installed plugin and exit
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$ROOT/plugins/opencode"
NAME="ai-monitoring"
TARGET="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}/plugins"
RUN_TESTS=1
DRY_RUN=0
UNINSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="${2:?--target needs a directory}"; shift 2 ;;
    --skip-tests) RUN_TESTS=0; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help) sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

if [[ $UNINSTALL -eq 1 ]]; then
  rm -rf "${TARGET:?}/$NAME" "$TARGET/$NAME.js"
  echo "removed $TARGET/$NAME.js"
  exit 0
fi

command -v node >/dev/null || { echo "node not found (run via 'mise run plugin:install')" >&2; exit 1; }
VERSION="$(node -p "require('$PLUGIN_DIR/package.json').version")"

cd "$PLUGIN_DIR"
npm ci --silent

if [[ $RUN_TESTS -eq 1 ]]; then
  echo "==> typecheck + tests"
  npm run --silent typecheck
  npm test --silent
fi

echo "==> build v$VERSION"
rm -rf dist
npm run --silent build

echo "==> verify bundle"
node --input-type=module -e '
  const m = await import(process.cwd() + "/dist/ai-monitoring.js");
  const d = m.default;
  if (Object.keys(m).join() !== "default" || d?.id !== "ai-monitoring" || typeof d.setup !== "function" || typeof d.server !== "function") {
    console.error("bundle must only default-export { id, setup (OpenCode 2), server (OpenCode 1) }"); process.exit(1);
  }
'

if [[ $DRY_RUN -eq 1 ]]; then
  echo "dry run: built $PLUGIN_DIR/dist/$NAME.js, nothing installed"
  exit 0
fi

mkdir -p "$TARGET"
cp dist/$NAME.js "$TARGET/$NAME.js.tmp"
# a leftover plugin directory from an earlier layout would be discovered as a second plugin (double counting)
rm -rf "${TARGET:?}/$NAME"
mv "$TARGET/$NAME.js.tmp" "$TARGET/$NAME.js"
echo "installed v$VERSION -> $TARGET/$NAME.js (works for OpenCode 1 and 2)"
echo "OpenCode 2 reloads plugins on change; OpenCode 1 takes effect on the next session"
