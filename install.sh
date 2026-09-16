#!/usr/bin/env bash
# constellation-MaxQ — install the complete split runtime from the repository.
# HOME-only: no /usr writes, dpkg -i, systemd units, or Chrome managed proxy.
set -euo pipefail

PREFIX="${MAXQ_HOME:-$HOME}"
BIN="$PREFIX/bin"
CONFIG="$PREFIX/.config/maxq"
REPO_REF="${MAXQ_REPO_REF:-main}"
RAW_BASE="${MAXQ_RAW_BASE:-https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/$REPO_REF}"
if [[ "$REPO_REF" =~ ^[0-9a-fA-F]{40}$ ]]; then
  DEFAULT_ARCHIVE="https://github.com/0sm0s1z/constellation-MaxQ/archive/$REPO_REF.tar.gz"
else
  DEFAULT_ARCHIVE="https://github.com/0sm0s1z/constellation-MaxQ/archive/refs/heads/$REPO_REF.tar.gz"
fi
REPO_ARCHIVE="${MAXQ_REPO_ARCHIVE:-$DEFAULT_ARCHIVE}"
ARCHIVE_SHA256="${MAXQ_ARCHIVE_SHA256:-}"
ICON_SRC="$CONFIG/icons-src"

mkdir -p "$BIN" "$CONFIG/theme/src" "$CONFIG/api-src" "$ICON_SRC" "$CONFIG/tmp"

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
  maxq-tabs
)
for part in "${runtime_parts[@]}"; do
  install_script "bin/$part" "$BIN/$part"
done

fail() {
  echo "maxq install: $*" >&2
  exit 1
}

sha256_file() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    fail "sha256 verification requires sha256sum or shasum"
  fi
}

verify_archive() {
  [ -n "$ARCHIVE_SHA256" ] || return 0
  [[ "$ARCHIVE_SHA256" =~ ^[0-9a-fA-F]{64}$ ]] || fail "MAXQ_ARCHIVE_SHA256 must be a 64-character hexadecimal SHA-256"
  local actual
  actual="$(sha256_file "$1")"
  [ "${actual,,}" = "${ARCHIVE_SHA256,,}" ] || fail "repository archive checksum mismatch"
}

api_ui_index() {
  local api_root="$1" candidate
  for candidate in \
    "$api_root/ui/index.html" \
    "$api_root/ui/dist/index.html" \
    "$api_root/ui/build/index.html"; do
    if [ -f "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

validate_seed_root() {
  local root="$1" api_root="$1/cmd/maxq-api"
  [ -d "$root/share/theme" ] || fail "repository archive missing share/theme"
  [ -d "$root/share/icons" ] || fail "repository archive missing share/icons"
  [ -d "$api_root" ] || fail "repository archive missing cmd/maxq-api"
  [ -f "$api_root/main.go" ] || fail "repository archive missing cmd/maxq-api/main.go"
  [ -f "$api_root/go.mod" ] || fail "repository archive missing cmd/maxq-api/go.mod"
  api_ui_index "$api_root" >/dev/null || fail "repository archive missing cmd/maxq-api UI index"
}

seed_repo_assets() {
  local root="$1"
  validate_seed_root "$root"
  rm -rf "$CONFIG/api-src"
  mkdir -p "$CONFIG/api-src"
  cp -a "$root/share/theme/." "$CONFIG/theme/src/"
  cp -a "$root/cmd/maxq-api/." "$CONFIG/api-src/"
  cp -a "$root/share/icons/." "$ICON_SRC/"
}

if [ -n "$HERE" ]; then
  [ -d "$HERE/cmd/maxq-api" ] || fail "local checkout missing cmd/maxq-api"
  seed_repo_assets "$HERE"
else
  tmp="$(mktemp -d "$CONFIG/tmp/maxq-install.XXXXXX")"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "$REPO_ARCHIVE" -o "$tmp/maxq.tar.gz"
  verify_archive "$tmp/maxq.tar.gz"
  tar -xzf "$tmp/maxq.tar.gz" -C "$tmp"
  shopt -s nullglob
  roots=("$tmp"/constellation-MaxQ-*)
  shopt -u nullglob
  [ "${#roots[@]}" -eq 1 ] || fail "repository archive must contain exactly one root directory"
  root="${roots[0]}"
  [ -d "$root" ] || fail "repository archive root missing"
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
[ -f "$CONFIG/api-src/main.go" ] || fail "current maxq-api source was not seeded"
[ -f "$CONFIG/api-src/go.mod" ] || fail "current maxq-api go.mod was not seeded"
api_ui_index "$CONFIG/api-src" >/dev/null || fail "current maxq-api UI was not seeded"

if [ "$#" -eq 0 ]; then
  exec "$BIN/maxq" apply
fi
exec "$BIN/maxq" "$@"
