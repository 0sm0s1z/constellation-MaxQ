# MaxQ desktop wallpaper and launcher

`maxq apply` installs the pastel MaxQ wallpaper at
`$HOME/.local/share/backgrounds/maxq/pastel.png` and marks the directory as
MaxQ-owned. When `DISPLAY` or `WAYLAND_DISPLAY` is present, MaxQ best-effort
live-applies it through GNOME `gsettings`, `feh`, `nitrogen`, or `swaymsg`.
Headless apply remains successful.

The app launcher is installed at `$HOME/bin/maxq-launcher` with the discoverable
entry `$HOME/.local/share/applications/maxq-launcher.desktop`. Backend order is
rofi (`rofi -show drun`), fuzzel, wofi, then dmenu. GNOME sessions receive a
persistent custom keybinding for **Super+Space**; all sessions also get the
portable shortcut manifest at `$HOME/.config/maxq/shortcuts.conf`.

The wallpaper's top-right terminal card documents the stable operator shortcuts:

| Shortcut | Action |
| --- | --- |
| Super+Space | App launcher |
| `maxq apply` | Apply desktop state |
| `maxq status` | Show state |
| `maxq prove` | Verify installation |

`maxq prove` checks the wallpaper, ownership marker, launcher executable,
desktop entry, and shortcut manifest. No Chrome policy is written.
