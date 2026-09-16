#!/usr/bin/env bash
# constellation-MaxQ — install the complete split runtime from the repository.
# HOME-only: no /usr writes, dpkg -i, systemd units, or Chrome managed proxy.
set -euo pipefail

PREFIX="${MAXQ_HOME:-$HOME}"
BIN="$PREFIX/bin"
CONFIG="$PREFIX/.config/maxq"
RAW_BASE="${MAXQ_RAW_BASE:-https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main}"
REPO_ARCHIVE="${MAXQ_REPO_ARCHIVE:-https://github.com/0sm0s1z/constellation-MaxQ/archive/refs/heads/main.tar.gz}"
ICON_SRC="$CONFIG/icons-src"

mkdir -p "$BIN" "$CONFIG/theme/src" "$CONFIG/api-src" "$ICON_SRC"

HERE=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

install_script() {
  local rel="$1" dest="$2"
  if [ -n "$HERE" ] && [ -f "$HERE/$rel" ]; then
    cp -f "$HERE/$rel" "$dest"
  else
    curl -fsSL "$RAW_BASE/$rel" -o "$dest"
  fi
  chmod +x "$dest"
}

runtime_parts=(
  maxq
  maxq-core
  maxq-desktop-gate
  maxq-desktop
  maxq-desktop-ghostty
  maxq-desktop-launcher
  maxq-desktop-shortcuts
  maxq-desktop-chrome
  maxq-desktop-dark
  maxq-packages
  maxq-novnc
)
for part in "${runtime_parts[@]}"; do
  install_script "bin/$part" "$BIN/$part"
done

seed_repo_assets() {
  local root="$1"
  [ -d "$root/share/theme" ] && cp -a "$root/share/theme/." "$CONFIG/theme/src/"
  if [ -d "$root/cmd/maxq-api" ]; then
    rm -rf "$CONFIG/api-src"
    mkdir -p "$CONFIG/api-src"
    cp -a "$root/cmd/maxq-api/." "$CONFIG/api-src/"
  fi
  if [ -d "$root/share/icons" ]; then
    mkdir -p "$ICON_SRC"
    cp -a "$root/share/icons/." "$ICON_SRC/"
  fi
}

if [ -n "$HERE" ] && [ -d "$HERE/cmd/maxq-api" ]; then
  seed_repo_assets "$HERE"
else
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/maxq-install.XXXXXX")"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "$REPO_ARCHIVE" -o "$tmp/maxq.tar.gz"
  tar -xzf "$tmp/maxq.tar.gz" -C "$tmp"
  root="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d -name 'constellation-MaxQ-*' -print -quit)"
  [ -n "$root" ] || { echo "maxq install: repository archive root missing" >&2; exit 1; }
  seed_repo_assets "$root"
fi

# Fail early if the split shape is incomplete instead of allowing maxq apply to
# degrade into the old three-file runtime.
for part in "${runtime_parts[@]}"; do
  [ -x "$BIN/$part" ] || { echo "maxq install: missing runtime part $BIN/$part" >&2; exit 1; }
done
for icon in chatgpt grok claude discord slack ghostty settings; do
  [ -s "$ICON_SRC/$icon.png" ] || { echo "maxq install: missing icon $ICON_SRC/$icon.png" >&2; exit 1; }
done
[ -f "$CONFIG/api-src/main.go" ] || { echo "maxq install: current maxq-api source was not seeded" >&2; exit 1; }

if [ "$#" -eq 0 ]; then
  exec "$BIN/maxq" apply
fi
exec "$BIN/maxq" "$@"
