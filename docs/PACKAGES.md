# MaxQ packages and SBOM

`install.sh` and `maxq apply` provision the standard MaxQ operator/runtime set under the shared UNIX user's HOME. This is desired-state installation, not a system package manager: MaxQ never runs `dpkg -i`, never writes `/usr`, and never requires systemd or root.

## Default runtime set

- Netadmin: `traceroute`, `dig`, `nslookup`, `host`, `pingpp`, `ping`
- Go: pinned official linux-amd64 runtime under `$HOME/.local/go`
- JavaScript/TypeScript: Bun, Node LTS, TypeScript compiler under `$HOME/.local`
- Python 3: preexisting image runtime; MaxQ proves and inventories it but does not overwrite it
- Docker: static Docker CLI under HOME. MaxQ does not require a daemon; `docker-daemon` is recorded as `missing` when none is already available
- Existing MaxQ operator CLIs, GOST, Ghostty and rofi are also represented in the inventory when present

Downloaded archives and Debian `.deb` files are cached below `$HOME/.config/maxq/cli-cache/`. Debian packages are extracted with `dpkg-deb -x` into HOME-only roots; they are never installed into the host package database.

## Grok Bot ping/network safety

`$HOME/bin/ping` delegates to `$HOME/bin/pingpp`, which is TCP-only. `pingpp` requires `-no-icmp`; MaxQ does not issue ICMP probes from Grok Bot. The wrapper refuses targets resolving into `10.0.0.0/16`. `maxq prove` performs version checks only and never sends a probe to a target.

## SBOM

Apply writes `$HOME/.config/maxq/sbom.json` as a JSON array. Every record has:

```json
{
  "name": "go",
  "version": "go version go1.26.5 linux/amd64",
  "path": "/home/box/bin/go",
  "source": "maxq"
}
```

`source` is `maxq` or `preexisting`. Revert removes/restores MaxQ-owned runtime paths but does not delete preexisting tools. The thin settings service exposes the same array at `GET /sbom`; the Packages card is inventory-only and has no apt/yum-style mutation controls.

The HOME-only desired-state reconciler ultimately executes `$HOME/bin/maxq apply`, so Grok Bot Update recovery refreshes the runtime set, desktop/theme state, Chrome External Extensions seeds, API/settings service, and SBOM together.
