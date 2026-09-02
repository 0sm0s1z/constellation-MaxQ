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
API_SRC="$PREFIX/.config/maxq/api-src"

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

# Theme pack (wallpaper/GTK/cursor/chrome/ghostty). Optional; apply can download/generate.
if [ -n "$HERE" ] && [ -d "$HERE/share/theme" ]; then
  mkdir -p "$PREFIX/.config/maxq/theme/src"
  cp -a "$HERE/share/theme/." "$PREFIX/.config/maxq/theme/src/"
fi

# Control API source (Go + thin Mocha sheet). apply builds $HOME/bin/maxq-api.
mkdir -p "$API_SRC/ui"
if [ -n "$HERE" ] && [ -d "$HERE/cmd/maxq-api" ]; then
  cp -a "$HERE/cmd/maxq-api/." "$API_SRC/"
else
  for path in go.mod main.go ui/index.html ui/mocha.css ui/sheet.js; do
    curl -fsSL "$RAW_BASE/cmd/maxq-api/$path" -o "$API_SRC/$path"
  done
fi

if [ "$#" -eq 0 ]; then
  exec "$BIN/maxq" apply
fi
exec "$BIN/maxq" "$@"
