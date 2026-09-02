#!/usr/bin/env bash
# constellation-MaxQ — from stock to MaxQ in one command.
# Persist-safe: installs only under $HOME and applies desired state.
set -euo pipefail

PREFIX="${MAXQ_HOME:-$HOME}"
BIN="$PREFIX/bin"
CONFIG="$PREFIX/.config/maxq"
RAW_BASE="${MAXQ_RAW_BASE:-https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main}"
mkdir -p "$BIN" "$CONFIG/api-src/ui" "$CONFIG/theme/src"
HERE=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; fi
install_script(){ local rel="$1" dest="$2"; if [ -n "$HERE" ] && [ -f "$HERE/$rel" ]; then cp -f "$HERE/$rel" "$dest"; else curl -fsSL "$RAW_BASE/$rel" -o "$dest"; fi; chmod +x "$dest"; }
install_script bin/maxq "$BIN/maxq"
install_script bin/maxq-core "$BIN/maxq-core"
install_script bin/maxq-desktop "$BIN/maxq-desktop"
install_script bin/maxq-desktop-ghostty "$BIN/maxq-desktop-ghostty"
install_script bin/maxq-desktop-launcher "$BIN/maxq-desktop-launcher"
install_script bin/maxq-desktop-shortcuts "$BIN/maxq-desktop-shortcuts"
if [ -n "$HERE" ] && [ -d "$HERE/share/theme" ]; then cp -a "$HERE/share/theme/." "$CONFIG/theme/src/"; fi
if [ -n "$HERE" ] && [ -d "$HERE/cmd/maxq-api" ]; then cp -a "$HERE/cmd/maxq-api/." "$CONFIG/api-src/"; else
  for rel in go.mod main.go main_test.go ui/index.html ui/mocha.css ui/sheet.js ui/sheet.ts; do mkdir -p "$(dirname "$CONFIG/api-src/$rel")"; curl -fsSL "$RAW_BASE/cmd/maxq-api/$rel" -o "$CONFIG/api-src/$rel"; done
fi
if [ "$#" -eq 0 ]; then exec "$BIN/maxq" apply; fi
exec "$BIN/maxq" "$@"
