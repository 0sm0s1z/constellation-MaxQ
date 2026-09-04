# MaxQ Catppuccin Mocha theme

Default in `maxq.toml` is `theme = "mocha"`. Latte is reserved as a future flag only; apply still ships Mocha.

## What apply installs (persist under `$HOME`)

- Wallpaper: `$HOME/.local/share/backgrounds/maxq/mocha.png`
- GTK: `$HOME/.local/share/themes/MaxQ-Catppuccin-Mocha` (official catppuccin/gtk Mocha Mauve, renamed)
- Cursors: `$HOME/.local/share/icons/MaxQ-Catppuccin-Mocha` (official catppuccin/cursors Mocha Mauve, renamed)
- GTK settings: `$HOME/.config/gtk-3.0/settings.ini` and `gtk-4.0/settings.ini` (MaxQ-owned block)
- Ghostty: `$HOME/.config/ghostty/config` MaxQ block + `themes/catppuccin-mocha.conf`
- Chrome theme files: `$HOME/.local/share/maxq/chrome-theme-mocha` (unpacked official Mocha)
- Chrome live-apply: External Extensions JSON under each existing `$HOME/chrome-profile*` (see below)

Revert deletes those MaxQ-owned files and MaxQ-written External Extensions artifacts only. It does not wipe `$HOME`, SSH, Chrome profiles (cookies/logins), or Chrome managed policies.

## Ghostty binary (gap)

Ghostty does not publish an official Linux amd64 binary. Building it needs Zig plus GTK4/libadwaita; community AppImages need FUSE. MaxQ is **config-only** for Ghostty. Drop a `ghostty` binary in `$HOME/bin` yourself if you want the app; the Mocha config still applies.

## Chrome theme (HOME-only live-apply)

Official Web Store ID: `bkkmolkhemgaeaeggcmfbghljjjoofoh`

### Unpacked install (unchanged)

Apply still unpacks the official Catppuccin Mocha theme to `$HOME/.local/share/maxq/chrome-theme-mocha` (plus `MAXQ.txt`). That path stays available for manual "Load unpacked" if needed.

### Live-apply mechanism

For each **existing** MaxQ profile directory matching `$HOME/chrome-profile` or `$HOME/chrome-profile-*` (custom `--user-data-dir` roots), apply writes:

```
$PROFILE/External Extensions/bkkmolkhemgaeaeggcmfbghljjjoofoh.json
$PROFILE/External Extensions/bkkmolkhemgaeaeggcmfbghljjjoofoh.json.maxq-owned
```

JSON body (Chrome-supported External Extensions format):

```json
{
  "external_update_url": "https://clients2.google.com/service/update2/crx"
}
```

The filename is the Web Store extension/theme id. Chrome reads `External Extensions/` at the user-data-dir root and registers that id for the profile. The empty `.maxq-owned` sidecar marks MaxQ ownership so revert can remove only what MaxQ wrote.

This is **HOME-only** and profile-scoped. MaxQ does **not**:

- write Chrome `ProxyMode` / `ProxyServer`
- write `/etc/opt/chrome/policies/managed/` proxy or theme force-install policies
- touch `$HOME/.config/google-chrome` (not a MaxQ profile)
- mutate other agents' profiles outside `chrome-profile*`

On revert, MaxQ removes only those MaxQ-owned External Extensions files (when the `.maxq-owned` sidecar is present) and leaves the rest of each profile intact.

### Why External Extensions (not Preferences path / unpacked dir)

Chrome's External Extensions JSON accepts `external_update_url` (Web Store) or `external_crx` + `external_version` (local `.crx`). It does **not** accept an unpacked theme directory path. MaxQ therefore keeps the unpacked tree on disk and live-applies via the store id update URL — the same official Mocha theme content as the unpacked zip.

### Limitations (prove does not require UI pixels)

- Chrome often ignores new External Extensions until **relaunch** (quit all windows for that `--user-data-dir`).
- First activation may need **network** so Chrome can fetch the store theme for that id.
- Themes are not extensions in the toolbar sense; Chrome may still show the default chrome until the theme is installed/enabled after relaunch.
- `maxq prove` asserts activation **files** (JSON + sidecar pointing at the store update endpoint / store id). It does **not** fail solely because Chrome UI pixels are not Mocha yet.
- Live-apply is additive on top of the unpacked install; summary line is `chrome_theme_live=external_extensions profiles=N`.

## Sources

- https://github.com/catppuccin/gtk (v1.0.3, archived)
- https://github.com/catppuccin/cursors (v2.0.0)
- https://github.com/catppuccin/chrome (v5.0.0)
- https://github.com/catppuccin/ghostty
