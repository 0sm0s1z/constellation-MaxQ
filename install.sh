#!/usr/bin/env bash
# constellation-MaxQ — from stock to MaxQ in one command.
# Persist-safe: installs the CLI under $HOME/bin and applies desired state.
set -euo pipefail

PREFIX="${MAXQ_HOME:-$HOME}"
BIN="$PREFIX/bin"
RAW_BASE="${MAXQ_RAW_BASE:-https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main}"
REPO_ARCHIVE="https://github.com/0sm0s1z/constellation-MaxQ/archive/refs/heads/main.tar.gz"

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

mkdir -p "$PREFIX/.config/maxq/theme/src" "$PREFIX/.config/maxq/api-src"

if [ -n "$HERE" ] && [ -d "$HERE/share/theme" ]; then
  cp -a "$HERE/share/theme/." "$PREFIX/.config/maxq/theme/src/"
else
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "$REPO_ARCHIVE" -o "$tmp/maxq.tar.gz"
  tar -xzf "$tmp/maxq.tar.gz" -C "$tmp"
  cp -a "$tmp"/constellation-MaxQ-main/share/theme/. "$PREFIX/.config/maxq/theme/src/" 2>/dev/null || true
  cp -a "$tmp"/constellation-MaxQ-main/cmd/maxq-api/. "$PREFIX/.config/maxq/api-src/" 2>/dev/null || true
fi

if [ -n "$HERE" ] && [ -d "$HERE/cmd/maxq-api" ]; then
  cp -a "$HERE/cmd/maxq-api/." "$PREFIX/.config/maxq/api-src/"
fi

if [ -d "$PREFIX/.config/maxq/api-src" ] && [ -n "$(find "$PREFIX/.config/maxq/api-src" -mindepth 1 -print -quit)" ]; then
  :
fi

if [ "$#" -eq 0 ]; then
  exec "$BIN/maxq" apply
fi
exec "$BIN/maxq" "$@"
