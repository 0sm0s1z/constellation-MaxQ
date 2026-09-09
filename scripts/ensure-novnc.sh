#!/usr/bin/env bash
# Start websockify/noVNC for live X displays that already have x11vnc.
# When the preferred viewer port (6080+(n-1)) is occupied by a non-matching
# listener (e.g. sand token-gateway on 6081), fall back to 6180+(n-1).
set -euo pipefail

viewer_cmdline_for_port() {
  local port=$1 f cmd
  for f in /proc/[0-9]*/cmdline; do
    [[ -r "$f" ]] || continue
    cmd=$(tr '\0' ' ' <"$f" 2>/dev/null || true)
    [[ "$cmd" == *websockify* ]] || continue
    [[ "$cmd" == *"0.0.0.0:${port}"* ]] || continue
    printf '%s' "$cmd"
    return 0
  done
  return 1
}

port_listening() {
  local port=$1
  ss -ltn | awk '{print $4}' | grep -Eq ":${port}$"
}

started=0; ready=0; novnc=0
for sock in /tmp/.X11-unix/X*; do
  [[ -e "$sock" ]] || continue
  n=${sock##*/X}
  [[ "$n" =~ ^[0-9]+$ ]] || continue
  if [[ "$n" == "1" ]]; then
    vnc=5900
  else
    vnc=$((5900 + n))
  fi
  preferred=$((6080 + n - 1))
  alt=$((6180 + n - 1))
  http=$preferred

  cmd=$(viewer_cmdline_for_port "$preferred" || true)
  if [[ -n "$cmd" && "$cmd" == *"localhost:${vnc}"* ]]; then
    ready=$((ready+1)); continue
  fi
  cmd_alt=$(viewer_cmdline_for_port "$alt" || true)
  if [[ -n "$cmd_alt" && "$cmd_alt" == *"localhost:${vnc}"* ]]; then
    ready=$((ready+1)); continue
  fi

  if port_listening "$preferred"; then
    # Foreign on preferred — use alt when free (or already matched above).
    if port_listening "$alt"; then
      # Both preferred and alt occupied by non-matching listeners; cannot start.
      continue
    fi
    http=$alt
  fi

  if ! ss -ltn | grep -Eq "127.0.0.1:${vnc}\\b"; then
    novnc=$((novnc+1)); continue
  fi
  if [[ -x /usr/local/bin/box-bounded-log ]]; then
    nohup /usr/local/bin/box-bounded-log --run "/tmp/novnc:${n}.log" -- \
      websockify --web=/usr/share/novnc --heartbeat=30 "0.0.0.0:${http}" "localhost:${vnc}" \
      >/dev/null 2>&1 &
  else
    nohup websockify --web=/usr/share/novnc --heartbeat=30 "0.0.0.0:${http}" "localhost:${vnc}" \
      >>"/tmp/novnc:${n}.log" 2>&1 &
  fi
  started=$((started+1))
done
echo "ensure-novnc started=$started ready=$ready no_vnc=$novnc"
