# MaxQ split runtime, packages, and SBOM

`install.sh` installs the complete MaxQ runtime from this repository under the shared user's HOME. A reference host or rsync is not part of the install path.

## Installed runtime shape

The public entrypoint is `$HOME/bin/maxq`. It composes these repository-managed modules:

- `maxq-core` — current core desired-state engine and maxq-api build/start logic
- `maxq-desktop` plus `maxq-desktop-{ghostty,launcher,shortcuts,chrome,dark}` — HOME-only desktop composition
- `maxq-desktop-gate` — the current eyes-proven desktop release gate from issue #69
- `maxq-packages` — HOME-only admin/development runtimes and SBOM
- `maxq-novnc` — HOME-only noVNC assets under `$HOME/.local/share/maxq/novnc`

`install.sh` also seeds the current repository's complete `cmd/maxq-api` tree, theme assets, and application icons. It does not carry the stale PR #6 API implementation over current main.

## Apply order

A fresh `maxq apply` runs the package layer first so `$HOME/bin/go` is available if the core needs to compile `maxq-api`. It then applies the current core, supplemental desktop state, refreshes the SBOM, installs noVNC, and finally runs `maxq-desktop-gate`.

The final gate ordering is intentional: issue #69 remains authoritative for the real XFCE `Super+Space` binding, live Plank pin, Ghostty runtime/theme, and graphical fail-closed behavior. The supplemental desktop module does not implement wallpaper painting; issue #68's core proof remains the sole authority for live wallpaper paint and never accepts an XFCE path write by itself.

## HOME-only package set

`maxq-packages` provisions:

- netadmin tools: `traceroute`, `dig`, `nslookup`, `host`, `pingpp`, and the TCP-only `ping` wrapper
- pinned Go under `$HOME/.local/go`
- Bun, Node, and TypeScript under `$HOME/.local`
- static Docker CLI under HOME (no daemon installation)
- preexisting Python 3 is inventoried but not overwritten

Downloaded archives and Debian packages are cached under `$HOME/.config/maxq/cli-cache`. Debian packages are unpacked with `dpkg-deb -x` into HOME-only roots. MaxQ does not run `dpkg -i`.

## SBOM

Apply writes `$HOME/.config/maxq/sbom.json` as a JSON array. Entries contain `name`, `version`, `path`, and `source`; `source` is `maxq` or `preexisting`. The top-level `maxq prove` requires this file to be non-empty and structurally valid.

Example:

```json
{
  "name": "go",
  "version": "go version go1.26.5 linux/amd64",
  "path": "/home/box/bin/go",
  "source": "maxq"
}
```

## Safety boundaries

The split runtime is persist-safe under `$HOME/bin`, `$HOME/.config/maxq`, and `$HOME/.local` (plus MaxQ-owned per-profile Chrome External Extensions files already managed by the desktop/core theme path). It does not install files under `/usr`, run `dpkg -i`, create systemd units, or write Chrome managed `ProxyMode` / `ProxyServer` policy.

The generated reconciler is HOME-only. The desktop Chrome helper extends it so Update recovery re-enters `$HOME/bin/maxq apply`, restoring the same complete split desired state.
