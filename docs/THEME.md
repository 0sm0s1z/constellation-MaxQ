# MaxQ Catppuccin Mocha theme

Default in `maxq.toml` is `theme = "mocha"`. Latte is reserved as a future flag only; apply still ships Mocha.

## What apply installs (persist under `$HOME`)

- Wallpaper: `$HOME/.local/share/backgrounds/maxq/mocha.png`
- GTK: `$HOME/.local/share/themes/MaxQ-Catppuccin-Mocha` (official catppuccin/gtk Mocha Mauve, renamed)
- Cursors: `$HOME/.local/share/icons/MaxQ-Catppuccin-Mocha` (official catppuccin/cursors Mocha Mauve, renamed)
- GTK settings: `$HOME/.config/gtk-3.0/settings.ini` and `gtk-4.0/settings.ini` (MaxQ-owned block)
- Ghostty: `$HOME/bin/ghostty` wrapper + `$HOME/.config/ghostty/config` MaxQ block + `themes/catppuccin-mocha.conf` (default terminal)
- Launcher + shortcuts: Super+Space riced launcher; Desktop/plank icons from `$HOME/.config/maxq/defaults.toml`
- Chrome theme files: `$HOME/.local/share/maxq/chrome-theme-mocha` (unpacked official Mocha)
- Chrome store seed skeleton: `$HOME/.config/maxq/chrome-skel/External Extensions/bkkmolkhemgaeaeggcmfbghljjjoofoh.json`
- Every existing `$HOME/chrome-profile` and `$HOME/chrome-profile-*` gets a per-user-data-dir `External Extensions` seed for Catppuccin Chrome Theme - Mocha.

Revert deletes MaxQ-owned files only. It does not wipe `$HOME`, SSH, or Chrome profiles. For a pre-existing external-extension JSON, MaxQ preserves and restores the previous file instead of deleting it.

## Ghostty (default terminal)

MaxQ pins the Ghostty 1.3.1 x86_64 AppImage in `$HOME/.config/maxq/cli-cache/` and exposes `$HOME/bin/ghostty` as a persist-safe wrapper. The wrapper enables Mesa software OpenGL 4.5 for the Grok Bot Xvfb environment and remains the path used by the XFCE terminal helper and desktop launcher. No `systemd` or `update-alternatives` is required.

See docs/DESKTOP.md.

## Chrome theme (live-applied to all agent profiles)

Official Web Store ID: `bkkmolkhemgaeaeggcmfbghljjjoofoh`

PLAN 8 is box-default, not DISPLAY-local. On `maxq apply`, MaxQ writes this per-user-data-dir file into every existing `$HOME/chrome-profile` and `$HOME/chrome-profile-*` (plus `CHROME_USER_DATA_DIR` when it resolves to one of those MaxQ agent profile paths):

```text
<profile>/External Extensions/bkkmolkhemgaeaeggcmfbghljjjoofoh.json
```

The file contains Chromium's user external-extension update URL:

```json
{
  "external_update_url": "https://clients2.google.com/service/update2/crx"
}
```

MaxQ keeps the same JSON as a skeleton under `$HOME/.config/maxq/chrome-skel/External Extensions/`. The HOME-only `$HOME/bin/maxq-reconcile` desired-state script re-scans `$HOME/chrome-profile*` and seeds profiles created after apply. This does not depend on PATH interception of `box-chrome`.

MaxQ does **not** write `/etc/opt/chrome/policies/managed/`, does not set `ProxyMode`, `ProxyServer`, or `ExtensionInstallForcelist`, does not use `--load-extension`, and does not modify `/usr/local/bin/box-chrome`. It does not restore CONNECT proxy state, `cxn-egress.json`, or `/tmp/sand-egress-proxy`.

Apply and prove do not kill, restart, or signal Chrome. A Chrome process already running can continue unchanged; the persisted external-extension seed is consumed on a subsequent Chrome start. `maxq prove` verifies the unpacked manifest, skeleton, every existing agent user-data-dir, and the reconciler seed logic. It does not fail merely because an already-running Chrome has not restarted yet.

## Sources

- https://github.com/catppuccin/gtk (v1.0.3, archived)
- https://github.com/catppuccin/cursors (v2.0.0)
- https://github.com/catppuccin/chrome (v5.0.0)
- https://github.com/catppuccin/ghostty
