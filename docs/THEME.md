# MaxQ Catppuccin Mocha theme

Default in `maxq.toml` is `theme = "mocha"`. Latte is reserved as a future flag only; apply still ships Mocha.

## What apply installs (persist under `$HOME`)

- Wallpaper: `$HOME/.local/share/backgrounds/maxq/mocha.png`
- GTK: `$HOME/.local/share/themes/MaxQ-Catppuccin-Mocha` (official catppuccin/gtk Mocha Mauve, renamed)
- Cursors: `$HOME/.local/share/icons/MaxQ-Catppuccin-Mocha` (official catppuccin/cursors Mocha Mauve, renamed)
- GTK settings: `$HOME/.config/gtk-3.0/settings.ini` and `gtk-4.0/settings.ini` (MaxQ-owned block)
- Ghostty: `$HOME/.config/ghostty/config` MaxQ block + `themes/catppuccin-mocha.conf`
- Chrome theme files: `$HOME/.local/share/maxq/chrome-theme-mocha` (unpacked official Mocha)

Revert deletes those MaxQ-owned files only. It does not wipe `$HOME`, SSH, Chrome profiles, or Chrome managed policies.

## Ghostty binary (gap)

Ghostty does not publish an official Linux amd64 binary. Building it needs Zig plus GTK4/libadwaita; community AppImages need FUSE. MaxQ is **config-only** for Ghostty. Drop a `ghostty` binary in `$HOME/bin` yourself if you want the app; the Mocha config still applies.

## Chrome theme (not live-applied)

Official Web Store ID: `bkkmolkhemgaeaeggcmfbghljjjoofoh`

MaxQ does not set Chrome flags or write `/etc/opt/chrome/policies/managed/` (no `ProxyMode`/`ProxyServer`, no theme force-install). Load the unpacked theme from the persist dir, or install from the store. `maxq prove` checks files on disk; it does **not** fail if Chrome is not showing the theme.

## Sources

- https://github.com/catppuccin/gtk (v1.0.3, archived)
- https://github.com/catppuccin/cursors (v2.0.0)
- https://github.com/catppuccin/chrome (v5.0.0)
- https://github.com/catppuccin/ghostty
