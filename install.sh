#!/usr/bin/env bash
# constellation-MaxQ — from stock to MaxQ in one command.
# Persist-safe: installs the CLI under $HOME/bin and applies desired state.
# Usage:
#   ./install.sh              # install CLI + apply
#   ./install.sh prove        # install CLI + run prove
#   curl -fsSL .../install.sh | bash
set -euo pipefail

PREFIX="${MAXQ_HOME:-$HOME}"
BIN="$PREFIX/bin"
RAW_BASE="${MAXQ_RAW_BASE:-https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main}"

mkdir -p "$BIN"

HERE=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [ -n "$HERE" ] && [ -f "$HERE/bin/maxq" ]; then
  cp -f "$HERE/bin/maxq" "$BIN/maxq"
else
  curl -fsSL "$RAW_BASE/bin/maxq" -o "$BIN/maxq"
fi
chmod +x "$BIN/maxq"

if [ "$#" -eq 0 ]; then
  exec "$BIN/maxq" apply
fi
exec "$BIN/maxq" "$@"
