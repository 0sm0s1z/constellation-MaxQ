# constellation-MaxQ

**Take your Grok Bot to MaxQ.**

One command turns the stock computer into a fully-equipped agent workstation.

```bash
curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash
```

Site (Vite + TypeScript, Catppuccin Mocha, terminal chrome): [`web/`](web/). Point Vercel Root Directory at `web/`.

From a checkout:

```bash
./install.sh
maxq status          # applied | reverted
maxq apply           # configure (idempotent)
maxq revert          # unconfigure MaxQ-owned files only
maxq prove           # revert/apply/assert cycle; leaves APPLIED
maxq proxy           # GOST settings (local process only)
maxq proxy on|off
maxq proxy upstream <url>
maxq proxy iface <name>
```

Control API listens on loopback only (`http://127.0.0.1:7432/`). `maxq apply` starts `$HOME/bin/maxq-api` (pidfile); `maxq revert` stops it. The API serves a thin Catppuccin Mocha settings sheet (status, apply/revert, proxy on/off). Vault/OAuth/skills are placeholders. It never writes Chrome proxy policy.

Persist under `$HOME` (`bin`, `.config/maxq`, `.local`). Theme default is Catppuccin Mocha (`theme = "mocha"` in `maxq.toml`; latte is a future flag only).

Apply installs Mocha wallpaper, GTK, and cursors under `$HOME/.local/share`, a Ghostty Mocha config block, and the official Catppuccin Mocha Chrome theme unpacked at `$HOME/.local/share/maxq/chrome-theme-mocha` (Web Store id `bkkmolkhemgaeaeggcmfbghljjjoofoh`). Chrome is live-applied **HOME-only** via External Extensions JSON under each existing `$HOME/chrome-profile*` (store id + `external_update_url`; `.maxq-owned` sidecar). No flags, no managed proxy/theme policies, no `$HOME/.config/google-chrome` mutation. Ghostty is **config-only** — there is no official Linux amd64 binary. See [docs/THEME.md](docs/THEME.md). Operator CLIs (herdr, Vercel fx, grok, Codex, Claude Code, OpenCode, Tailscale/tailscaled) are MaxQ-managed desired state under `$HOME/bin` when an official linux amd64 artifact exists. Existing paths at those command names are replaced by MaxQ; symlink destinations are never followed or overwritten. Skips are recorded in `$HOME/.config/maxq/clis.txt`. See [docs/CLIS.md](docs/CLIS.md).

The control API (`$HOME/bin/maxq-api`) binds `127.0.0.1:7432` (override with `$HOME/.config/maxq/api.toml`). Source lives in `cmd/maxq-api` (stdlib HTTP + embedded `ui/`). See [docs/API.md](docs/API.md).

GOST (`$HOME/bin/gost`, go-gost) is the local CONNECT proxy. Default is `enabled = false` and `intercept = false` (no MITM). `maxq proxy on` starts gost with a pidfile under `$HOME/.config/maxq`; it does **not** write Chrome `ProxyMode`/`ProxyServer` policies. The persist CA lives at `$HOME/.config/maxq/ca` and survives revert; trust install is documented there, not auto-applied to `/usr` or Chrome.

Revert never deletes `$HOME`, SSH keys, Chrome logins, Chrome managed policies, the GOST binary, the CA, the theme vendor cache, or the CLI download cache. MaxQ-owned operator CLIs (markers in `$HOME/.config/maxq/managed-clis`) are removed on revert and restored on the next apply. There is no legacy `preexisting` CLI state or keep-across-revert exception.

MaxQ is the point where your bot computer is fully loaded, configured, and operating at its limit.
