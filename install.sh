#!/usr/bin/env bash
# constellation-MaxQ — from stock to MaxQ in one command.
set -euo pipefail
PREFIX="${MAXQ_HOME:-$HOME}"
BIN="$PREFIX/bin"
CONFIG="$PREFIX/.config/maxq"
mkdir -p "$BIN" "$CONFIG"
echo "theme = \"mocha\"" > "$CONFIG/maxq.toml"
printf "%s\n" "#!/usr/bin/env bash" "echo \"MaxQ: take your Grok Bot to MaxQ.\"" > "$BIN/maxq"
chmod +x "$BIN/maxq"
echo "From stock to MaxQ. Installed $BIN/maxq"
