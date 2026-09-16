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
maxq tabs list       # current-display Chrome page targets via CDP
maxq tabs prune      # duplicate/blank-only conservative cleanup
maxq tabs prune --task-url <url>  # keep task + optional ChatGPT/GitHub
```

Browser automation should call `maxq tabs prune --task-url <active-task-url>` at the end of a browser task while task context is still known. CDP discovery is current-display/profile scoped and fails soft when unavailable; apply/reconcile do not prune tabs. See [docs/TABS.md](docs/TABS.md).

### Reproducible curl installs

For a curl|bash install, pin the script and archive to the same known-good
commit and provide the archive SHA-256. `MAXQ_REPO_ARCHIVE` and
`MAXQ_RAW_BASE` can instead point at an approved mirror:

```bash
export MAXQ_REPO_REF=<40-character-commit-sha>
export MAXQ_ARCHIVE_SHA256=<64-character-archive-sha256>
curl -fsSL "https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/$MAXQ_REPO_REF/install.sh" | bash
```

The installer verifies `MAXQ_ARCHIVE_SHA256` before extracting and fails closed
if the archive is missing the split runtime, icons, theme, or the API's
`main.go`, `go.mod`, and UI index. Its archive extraction directory is under
`$HOME/.config/maxq/tmp` (or the `MAXQ_HOME` prefix), not a system temp path.

Control API listens on loopback only (`http://127.0.0.1:7432/`). `maxq apply` starts `$HOME/bin/maxq-api` (pidfile); `maxq revert` stops it. The API serves a thin Catppuccin Mocha settings sheet (status, approvals, network control plane, apply/revert, proxy on/off). Vault/OAuth/skills are placeholders. It never writes Chrome proxy policy.

Approvals default **Off** for Constellation boxes. The settings master switch persists `$HOME/.config/maxq/policy.toml` as `[approvals] mode = "off"` / `always_allow = true`. That file is the approval source of truth: host/browser tooling must skip host Auto-review for always-allow actions when policy is Off, including `browserUse` social/external outbound. MaxQ does not try to force the host-owned `sand-data/settings.json` Auto-review bit off because that write can self-protect and deadlock; the policy decision happens before Auto-review instead. See [docs/API.md](docs/API.md).

Network control plane defaults to **Tailscale**. Fresh `maxq apply` behavior remains unchanged; network joins happen only when the operator chooses **Save & join** in the settings sheet. Selecting **Headscale** requires an operator-supplied HTTP(S) `login_server`; MaxQ runs the installed Tailscale client with `--login-server=<url>` and never silently falls back to Tailscale SaaS after a Headscale failure. Optional auth/preauth keys are stored HOME-only in `$HOME/.config/maxq/network.authkey` with mode `0600` and passed as `--auth-key=file:<path>`, so the key itself is not placed in argv or returned by the control API. Headscale ACLs often require a **tagged** preauth key — an untagged join can show Connected with 0 peers. See [docs/NETWORK.md](docs/NETWORK.md#enrollment-tags-headscale). Bot-guided setup skill installs with `maxq apply` from `share/skills/tailscale-setup-maxq-self-serve` (#93).

Persist under `$HOME` (`bin`, `.config/maxq`, `.local`). Theme default is Catppuccin Mocha (`theme = "mocha"` in `maxq.toml`; latte is a future flag only).

Apply installs Mocha wallpaper, GTK, and cursors under `$HOME/.local/share`, a Ghostty Mocha config block, and the official Catppuccin Mocha Chrome theme unpacked at `$HOME/.local/share/maxq/chrome-theme-mocha` (Web Store id `bkkmolkhemgaeaeggcmfbghljjjoofoh`). Chrome is live-applied **HOME-only** via External Extensions JSON under each existing `$HOME/chrome-profile*` (store id + `external_update_url`; `.maxq-owned` sidecar). No flags, no managed proxy/theme policies, no `$HOME/.config/google-chrome` mutation. Ghostty is **config-only** — there is no official Linux amd64 binary. See [docs/THEME.md](docs/THEME.md). Operator CLIs (herdr, Vercel fx, grok, Codex, Claude Code, OpenCode, Tailscale/tailscaled) are MaxQ-managed desired state under `$HOME/bin` when an official linux amd64 artifact exists. Existing paths at those command names are replaced by MaxQ; symlink destinations are never followed or overwritten. Skips are recorded in `$HOME/.config/maxq/clis.txt`. See [docs/CLIS.md](docs/CLIS.md).

The control API (`$HOME/bin/maxq-api`) binds `127.0.0.1:7432` (override with `$HOME/.config/maxq/api.toml`). Source lives in `cmd/maxq-api` (stdlib HTTP + embedded `ui/`). See [docs/API.md](docs/API.md).

GOST (`$HOME/bin/gost`, go-gost) is the local CONNECT proxy. Default is `enabled = false` and `intercept = false` (no MITM). `maxq proxy on` starts gost with a pidfile under `$HOME/.config/maxq`; it does **not** write Chrome `ProxyMode`/`ProxyServer` policies. The persist CA lives at `$HOME/.config/maxq/ca` and survives revert; trust install is documented there, not auto-applied to `/usr` or Chrome.

Revert never deletes `$HOME`, SSH keys, Chrome logins, Chrome managed policies, the GOST binary, the CA, the theme vendor cache, or the CLI download cache. MaxQ-owned operator CLIs (markers in `$HOME/.config/maxq/managed-clis`) are removed on revert and restored on the next apply. There is no legacy `preexisting` CLI state or keep-across-revert exception.

MaxQ is the point where your bot computer is fully loaded, configured, and operating at its limit.
