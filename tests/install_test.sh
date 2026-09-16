#!/usr/bin/env bash
# Installer smoke tests. They intentionally avoid PIL and graphical dependencies.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
server_pid=""
cleanup() {
  if [ -n "$server_pid" ]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$tmp"
}
trap cleanup EXIT

mkdir -p "$tmp/raw/bin"
cp "$repo_root/install.sh" "$tmp/raw/install.sh"
for part in \
  maxq maxq-core maxq-desktop-gate maxq-desktop maxq-desktop-ghostty \
  maxq-desktop-launcher maxq-desktop-shortcuts maxq-desktop-chrome \
  maxq-desktop-dark maxq-packages maxq-novnc; do
  cp "$repo_root/bin/$part" "$tmp/raw/bin/$part"
done

git -C "$repo_root" archive --format=tar.gz --prefix=constellation-MaxQ-test/ HEAD -- . ':!web/node_modules' > "$tmp/maxq.tar.gz"
sha256="$(sha256sum "$tmp/maxq.tar.gz" | awk '{print $1}')"

# Serve both the curl|bash script and the archive without external services.
python3 -u - "$tmp" "$tmp/port" <<'PY' >"$tmp/server.log" 2>&1 &
import http.server
import os
import pathlib
import sys

root = pathlib.Path(sys.argv[1]).resolve()
port_file = pathlib.Path(sys.argv[2])
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass
os.chdir(root)
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
port_file.write_text(str(server.server_address[1]))
server.serve_forever()
PY
server_pid=$!
for _ in $(seq 1 50); do
  [ -s "$tmp/port" ] && break
  sleep 0.1
done
[ -s "$tmp/port" ] || { cat "$tmp/server.log" >&2; exit 1; }
port="$(cat "$tmp/port")"
base="http://127.0.0.1:$port"

# Clone-path proof: BASH_SOURCE points at the checkout, so no archive is needed.
clone_home="$tmp/clone-home"
mkdir -p "$clone_home"
HOME="$clone_home" MAXQ_HOME="$clone_home" bash "$repo_root/install.sh" status >/dev/null
[ -f "$clone_home/.config/maxq/api-src/main.go" ]
[ -f "$clone_home/.config/maxq/api-src/go.mod" ]
[ -f "$clone_home/.config/maxq/api-src/ui/index.html" ]
[ -d "$clone_home/.config/maxq/tmp" ]

# curl|bash proof: force the archive path and verify it before extraction.
curl_home="$tmp/curl-home"
mkdir -p "$curl_home"
HOME="$curl_home" MAXQ_HOME="$curl_home" MAXQ_RAW_BASE="$base/raw" \
  MAXQ_REPO_ARCHIVE="$base/maxq.tar.gz" MAXQ_ARCHIVE_SHA256="$sha256" \
  bash <(curl -fsSL "$base/raw/install.sh") status >/dev/null
[ -f "$curl_home/.config/maxq/api-src/main.go" ]
[ -f "$curl_home/.config/maxq/api-src/go.mod" ]
[ -f "$curl_home/.config/maxq/api-src/ui/index.html" ]
[ -d "$curl_home/.config/maxq/tmp" ]

# Fail-closed proof: a curl archive missing go.mod must not install.
broken_root="$tmp/broken/constellation-MaxQ-test"
mkdir -p "$broken_root"
git -C "$repo_root" archive HEAD | tar -x -C "$broken_root"
rm "$broken_root/cmd/maxq-api/go.mod"
tar -czf "$tmp/broken.tar.gz" -C "$tmp/broken" constellation-MaxQ-test
broken_home="$tmp/broken-home"
mkdir -p "$broken_home"
if HOME="$broken_home" MAXQ_HOME="$broken_home" MAXQ_RAW_BASE="$base/raw" \
  MAXQ_REPO_ARCHIVE="$base/broken.tar.gz" bash <(curl -fsSL "$base/raw/install.sh") status >/dev/null 2>&1; then
  echo "expected missing go.mod archive to fail" >&2
  exit 1
fi

echo "install tests passed: clone-path, curl|bash checksum, and missing-go.mod fail-closed"
