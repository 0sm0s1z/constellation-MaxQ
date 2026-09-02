# constellation-MaxQ

**Take your Grok Bot to MaxQ.**

One command turns the stock computer into a fully-equipped agent workstation.

```bash
curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash
```

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

Persist under `$HOME` (`bin`, `.config/maxq`, `.local`). Theme default is Catppuccin Mocha (`theme = "mocha"` in `maxq.toml`; latte is a future flag only).

Apply installs Mocha wallpaper, GTK, and cursors under `$HOME/.local/share`, a Ghostty Mocha config block, and the official Catppuccin Mocha Chrome theme unpacked at `$HOME/.local/share/maxq/chrome-theme-mocha` (Web Store id `bkkmolkhemgaeaeggcmfbghljjjoofoh`). Chrome is **not** live-applied (no flags, no managed policies). Ghostty is **config-only** — there is no official Linux amd64 binary. See [docs/THEME.md](docs/THEME.md). Operator CLIs (herdr, Vercel fx, grok, Codex, Claude Code) install into `$HOME/bin` when an official linux amd64 binary exists; OpenCode and Tailscale are left in place if they already persist. Skips are recorded in `$HOME/.config/maxq/clis.txt`. See [docs/CLIS.md](docs/CLIS.md).

GOST (`$HOME/bin/gost`, go-gost) is the local CONNECT proxy. Default is `enabled = false` and `intercept = false` (no MITM). `maxq proxy on` starts gost with a pidfile under `$HOME/.config/maxq`; it does **not** write Chrome `ProxyMode`/`ProxyServer` policies. The persist CA lives at `$HOME/.config/maxq/ca` and survives revert; trust install is documented there, not auto-applied to `/usr` or Chrome.

Revert never deletes `$HOME`, SSH keys, Chrome logins, Chrome managed policies, the GOST binary, the CA, the theme vendor cache, the CLI download cache, or preexisting OpenCode/Tailscale. MaxQ-owned CLIs (markers in `$HOME/.config/maxq/managed-clis`) are removed on revert and restored on the next apply.

MaxQ is the point where your bot computer is fully loaded, configured, and operating at its limit.
