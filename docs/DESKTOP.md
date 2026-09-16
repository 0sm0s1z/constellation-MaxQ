# MaxQ desktop composition and release gates

The desktop is composed in layers. The split runtime adds Ghostty, rofi, shortcuts, icons, dark-mode state, and Chrome profile reconciliation around the current core; it does not replace the eyes-proven release gates from issues #68 and #69.

## Wallpaper: core #68 remains authoritative

`maxq-core` installs the MaxQ pastel wallpaper at `$HOME/.local/share/backgrounds/maxq/pastel.png`. In a graphical session, core apply/prove remains fail-closed until a real visual paint succeeds. XFCE backdrop configuration is persistence only and is not accepted by the split desktop module as proof that the visible root changed.

`maxq-desktop` deliberately contains no wallpaper setter. This prevents the stale PR #6 behavior from weakening #68.

## Ghostty

The supplemental desktop layer installs Ghostty 1.3.1 as a HOME-only AppImage-backed wrapper at `$HOME/bin/ghostty`, with Catppuccin Mocha configuration already supplied by the core theme path. It also installs:

- `$HOME/.local/share/applications/ghostty.desktop`
- an XFCE terminal helper under `$HOME/.local/share/xfce4/helpers/`
- `TerminalEmulator=ghostty` in the managed XFCE helper state
- a MaxQ Ghostty Plank dockitem file

A preexisting `$HOME/bin/ghostty` is backed up before MaxQ takes ownership. Revert restores it when applicable.

The final `maxq-desktop-gate` remains authoritative: Ghostty must be executable, answer `--version`, and use the MaxQ Mocha theme. There is no config-only green skip.

## Launcher and Super+Space

The split desktop installs a HOME-only rofi runtime when a working rofi is not already available, plus a Catppuccin Mocha launcher at `$HOME/bin/maxq-launcher`. The XFCE shortcut target is exactly:

```text
/commands/custom/<Super>space -> $HOME/bin/maxq-launcher
```

The final #69 gate re-applies and reads back the real binding in graphical sessions. It also removes the known stale MaxQ-owned `<Primary><Super>space` binding without removing unrelated operator shortcuts.

## Shortcuts and icons

`$HOME/.config/maxq/defaults.toml` controls the default AI chat and site URLs. Revert preserves operator edits to this file.

The repository supplies PNGs for ChatGPT, Grok, Claude, Discord, Slack, Ghostty, and MaxQ Settings. Apply copies them under `$HOME/.local/share/icons/maxq/` and creates HOME/Desktop and `.desktop` launcher entries. Site launchers use the current-display `box-chrome` path and do not hard-code another agent's Chrome profile.

## Plank

The supplemental desktop layer writes the richer MaxQ dockitem files. It does not claim that files alone are visible. The unchanged #69 gate owns the live release criterion: it creates/pins `maxq-launcher.dockitem` into Plank's actual dconf `dock-items`, reloads the current DISPLAY's Plank, and proves the item is live-pinned with a drawable icon.

On top-level revert the #69 gate runs first, so it removes the live pin before supplemental desktop cleanup removes MaxQ dockitem files.

## Dark mode and Chrome

XFCE dark theme/cursor state is persisted under HOME and applied live when DISPLAY is present. Previous values are captured for revert.

Chrome Mocha remains profile-scoped and HOME-owned. The desktop helper seeds the official theme's External Extensions JSON into allowed `$HOME/chrome-profile*` roots and extends the HOME-only reconciler for profiles created later. It does not write Chrome managed `ProxyMode` / `ProxyServer`, restore `cxn-egress.json`, signal Chrome, or use `--load-extension`.

## Proof ownership

Top-level `maxq prove` runs the current core proof first, then supplemental desktop/package/noVNC checks, and finally the unchanged #69 desktop gate. That ordering keeps the strongest existing visual and interaction gates authoritative while still proving the complete split runtime shape.
