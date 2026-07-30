#!/usr/bin/env bash
# Install the Until hard-rail hooks at user level (~/.cursor/hooks.json).
#
# WHY THIS EXISTS: Cursor currently dispatches plugin-shipped hooks for
# sessionStart, but the enforcement events (afterMCPExecution,
# beforeShellExecution, preToolUse) are only loaded from the enterprise /
# user / project / team hooks.json chain — not from a plugin's
# hooks-cursor.json (verified against Cursor's hooks service logs,
# 2026-07-08). Until plugins can register those events, the deterministic
# gate must be installed at user level. Run this once after cloning:
#
#   ./hooks/install-user-hooks.sh
#
# Safe to install globally: the gate is inert unless an Until Plan is
# in flight in that specific conversation (no state file -> allow all).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$HOME/.cursor/hooks.json"

if [ -f "$TARGET" ]; then
  if grep -q "until-commit-gate" "$TARGET"; then
    echo "Until hooks already present in $TARGET — nothing to do."
    exit 0
  fi
  echo "A $TARGET already exists. Merge these entries into it manually:"
  echo
  cat <<EOF
  "afterMCPExecution":    [{ "command": "${SCRIPT_DIR}/until-track-state" }],
  "beforeShellExecution": [{ "command": "${SCRIPT_DIR}/until-commit-gate" }],
  "preToolUse":           [{ "command": "${SCRIPT_DIR}/until-commit-gate" }]
EOF
  exit 1
fi

mkdir -p "$(dirname "$TARGET")"
cat > "$TARGET" <<EOF
{
  "version": 1,
  "hooks": {
    "afterMCPExecution": [
      { "command": "${SCRIPT_DIR}/until-track-state" }
    ],
    "beforeShellExecution": [
      { "command": "${SCRIPT_DIR}/until-commit-gate" }
    ],
    "preToolUse": [
      { "command": "${SCRIPT_DIR}/until-commit-gate" }
    ]
  }
}
EOF
echo "Installed Until hard-rail hooks to $TARGET (pointing at ${SCRIPT_DIR})."
echo "Reload Cursor (Developer: Reload Window) to activate."
