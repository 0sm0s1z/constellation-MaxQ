#!/usr/bin/env bash
# constellation-MaxQ — from stock to MaxQ in one command.
# Persist-safe: installs runtime under $HOME/bin and $HOME/.config/maxq.
# Usage:
#   ./install.sh              # install CLI + apply
#   ./install.sh prove        # install CLI + run prove
#   curl -fsSL .../install.sh | bash
set -euo pipefail

PREFIX="${MAXQ_HOME:-$HOME}"
BIN="$PREFIX/bin"
CONFIG="$PREFIX/.config/maxq"
RUNTIME="$CONFIG/runtime"
CORE="$RUNTIME/maxq-core"
API_BUNDLE="$BIN/cmd/maxq-api"
API_CACHE="$CONFIG/api-src"
SETUP_SKILL_DIR="$CONFIG/skills/maxq-setup"
SETUP_SKILL="$SETUP_SKILL_DIR/SKILL.md"
RAW_BASE="${MAXQ_RAW_BASE:-https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main}"

mkdir -p "$BIN" "$CONFIG" "$RUNTIME"

HERE=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

# Keep the proven CLI as a sourced runtime core. The small $HOME/bin/maxq
# wrapper adds only current-DISPLAY wallpaper persistence; the core retains
# apply/revert/prove behavior unchanged and sees $0 as $HOME/bin/maxq.
if [ -n "$HERE" ] && [ -f "$HERE/bin/maxq" ]; then
  cp -f "$HERE/bin/maxq" "$CORE"
else
  curl -fsSL "$RAW_BASE/bin/maxq" -o "$CORE"
fi
chmod +x "$CORE"

cat > "$BIN/maxq" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
PREFIX="${MAXQ_HOME:-$HOME}"
CORE="$PREFIX/.config/maxq/runtime/maxq-core"
ORIG_CMD="${1:-status}"

maxq_apply_wallpaper_current_display() {
  local wallpaper="$PREFIX/.local/share/backgrounds/maxq/mocha.png"
  [ -n "${DISPLAY:-}" ] || return 0
  [ -s "$wallpaper" ] || return 0

  if command -v hsetroot >/dev/null 2>&1; then
    if DISPLAY="$DISPLAY" hsetroot -cover "$wallpaper" >/dev/null 2>&1; then
      return 0
    fi
    DISPLAY="$DISPLAY" hsetroot -full "$wallpaper" >/dev/null 2>&1 || true
    return 0
  fi

  # XFCE fallback. Keep DISPLAY explicit so this is scoped to the current
  # graphical agent/session; do not enumerate or signal any other DISPLAY.
  if command -v xfconf-query >/dev/null 2>&1; then
    local props p
    props="$(DISPLAY="$DISPLAY" xfconf-query -c xfce4-desktop -l 2>/dev/null | grep '/last-image$' || true)"
    while IFS= read -r p; do
      [ -n "$p" ] || continue
      DISPLAY="$DISPLAY" xfconf-query -c xfce4-desktop -p "$p" -s "$wallpaper" >/dev/null 2>&1 || true
    done <<< "$props"
  fi
}

maxq_wrapper_exit() {
  local rc=$?
  trap - EXIT
  if [ "$rc" -eq 0 ]; then
    case "$ORIG_CMD" in
      apply|configure|prove) maxq_apply_wallpaper_current_display ;;
    esac
  fi
  exit "$rc"
}
trap maxq_wrapper_exit EXIT

if [ ! -r "$CORE" ]; then
  echo "maxq: runtime core missing: $CORE" >&2
  exit 1
fi

# shellcheck source=/dev/null
. "$CORE"
WRAPPER
chmod +x "$BIN/maxq"

# Theme pack (wallpaper/GTK/cursor/chrome/ghostty). Optional; apply can download/generate.
if [ -n "$HERE" ] && [ -d "$HERE/share/theme" ]; then
  mkdir -p "$CONFIG/theme/src"
  cp -a "$HERE/share/theme/." "$CONFIG/theme/src/"
fi

# Ship this install source's control API beside the CLI. bin/maxq's existing
# seed_api_src candidate order prefers $HOME/bin/cmd/maxq-api over api-src, so
# every later apply/prove refreshes the cache from this payload instead of
# rebuilding an older cached source tree.
rm -rf "$API_BUNDLE"
mkdir -p "$API_BUNDLE/ui"
if [ -n "$HERE" ] && [ -d "$HERE/cmd/maxq-api" ]; then
  cp -a "$HERE/cmd/maxq-api/." "$API_BUNDLE/"
else
  for rel in go.mod main.go main_test.go ui/index.html ui/mocha.css ui/sheet.js ui/sheet.ts; do
    mkdir -p "$API_BUNDLE/$(dirname "$rel")"
    curl -fsSL "$RAW_BASE/cmd/maxq-api/$rel" -o "$API_BUNDLE/$rel"
  done
fi
rm -rf "$API_CACHE"
mkdir -p "$API_CACHE"
cp -a "$API_BUNDLE/." "$API_CACHE/"

# PLAN 24 slice: install the first-run setup skill/prompt. It never carries a
# webhook value; the operator supplies one dynamically or leaves it empty.
rm -rf "$SETUP_SKILL_DIR"
mkdir -p "$SETUP_SKILL_DIR/agents"
if [ -n "$HERE" ] && [ -d "$HERE/share/skills/maxq-setup" ]; then
  cp -a "$HERE/share/skills/maxq-setup/." "$SETUP_SKILL_DIR/"
else
  if ! curl -fsSL "$RAW_BASE/share/skills/maxq-setup/SKILL.md" -o "$SETUP_SKILL"; then
    cat > "$SETUP_SKILL" <<'SKILL'
---
name: maxq-setup
description: Configure constellation-MaxQ first-run settings, especially the dynamic trigger webhook destination. Use during MaxQ setup or after updates when webhook routing needs to be enabled, cleared, rotated, or verified.
---

# MaxQ Setup

If `$HOME/.config/maxq/hooks.toml` has an empty or missing `webhook_url`, ask: **What HTTPS webhook URL should MaxQ use for trigger notifications? Leave it blank to keep hooks disabled.** Never invent or bake a URL. Persist only the operator-provided value; blank disables hooks. Prefer `POST /triggers/webhook` on loopback when available.
SKILL
  fi
  curl -fsSL "$RAW_BASE/share/skills/maxq-setup/agents/openai.yaml" -o "$SETUP_SKILL_DIR/agents/openai.yaml" 2>/dev/null || printf 'interface:
  display_name: "MaxQ Setup"
' > "$SETUP_SKILL_DIR/agents/openai.yaml"
fi
chmod 600 "$SETUP_SKILL"

if [ "$#" -eq 0 ]; then
  exec "$BIN/maxq" apply
fi
exec "$BIN/maxq" "$@"
