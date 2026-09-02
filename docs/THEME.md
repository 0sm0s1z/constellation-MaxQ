# MaxQ Catppuccin Mocha theme

Default in `maxq.toml` is `theme = "mocha"`. Latte is reserved as a future flag only; apply still ships Mocha.

## What apply installs (persist under `$HOME`)

- Wallpaper: `$HOME/.local/share/backgrounds/maxq/mocha.png`
- GTK: `$HOME/.local/share/themes/MaxQ-Catppuccin-Mocha` (official catppuccin/gtk Mocha Mauve, renamed)
- Cursors: `$HOME/.local/share/icons/MaxQ-Catppuccin-Mocha` (official catppuccin/cursors Mocha Mauve, renamed)
- GTK settings: `$HOME/.config/gtk-3.0/settings.ini` and `gtk-4.0/settings.ini` (MaxQ-owned block)
- Ghostty: `$HOME/bin/ghostty` + `$HOME/.config/ghostty/config` MaxQ block + `themes/catppuccin-mocha.conf` (default terminal)
- Launcher + shortcuts: Super+Space riced launcher; Desktop/plank icons from `$HOME/.config/maxq/defaults.toml`
- Chrome theme files: `$HOME/.local/share/maxq/chrome-theme-mocha` (unpacked official Mocha)

Revert deletes those MaxQ-owned files only. It does not wipe `$HOME`, SSH, Chrome profiles, or Chrome managed policies.

## Ghostty (default terminal)

Official Ghostty does not ship a Linux amd64 binary. MaxQ still installs the app: download a community linux amd64 (Debian Trixie `.deb` extract from mkasberg/ghostty-ubuntu, or a Universal AppImage) into `$HOME/bin/ghostty`. Mocha config stays at `$HOME/.config/ghostty/`. Apply sets Ghostty as the default terminal via persist-safe desktop files and xfce helpers.rc — never `update-alternatives`.

See docs/DESKTOP.md.

## Chrome theme (not live-applied)

Official Web Store ID: `bkkmolkhemgaeaeggcmfbghljjjoofoh`

MaxQ does not set Chrome flags or write `/etc/opt/chrome/policies/managed/` (no `ProxyMode`/`ProxyServer`, no theme force-install). Load the unpacked theme from the persist dir, or install from the store. `maxq prove` checks files on disk; it does **not** fail if Chrome is not showing the theme.

## Sources

- https://github.com/catppuccin/gtk (v1.0.3, archived)
- https://github.com/catppuccin/cursors (v2.0.0)
- https://github.com/catppuccin/chrome (v5.0.0)
- https://github.com/catppuccin/ghostty
