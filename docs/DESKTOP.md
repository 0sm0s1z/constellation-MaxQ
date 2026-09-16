# Desktop: Ghostty, launcher, shortcuts

MaxQ automates build/install/config so a bot needs fewer computer-use hops. Persist-safe only (`$HOME/bin`, `$HOME/.config/maxq`, `$HOME/.local`). PID1 is tini. Nothing in `/usr`. Do not use systemd timers or `update-alternatives`.

This computer is **X11** (Xvfb + xfwm4 + plank). It is not Hyprland.

## Ghostty default terminal

Install a linux amd64 Ghostty into `$HOME/bin/ghostty`.

Order:

1. Community Debian/Ubuntu `.deb` from https://github.com/mkasberg/ghostty-ubuntu (Debian 13 Trixie amd64). Extract with `dpkg-deb -x` into a persist prefix; copy the `ghostty` binary to `$HOME/bin`. Do not `dpkg -i` into `/usr`.
2. Else Universal AppImage from https://github.com/pkgforge-dev/ghostty-appimage (or current ghostty.org community AppImage). Install as `$HOME/bin/ghostty` (wrapper if needed).
3. Prove: `command -v ghostty` is `$HOME/bin/ghostty` and `--version` works.

Default:

- `$HOME/.local/share/applications/ghostty.desktop` (`Terminal=false`, `Exec=$HOME/bin/ghostty`)
- `$HOME/.config/xfce4/helpers.rc` `TerminalEmulator=ghostty` (MaxQ-owned block)
- plank dockitem for Ghostty
- `mimeapps.list` x-scheme-handler/terminal if used

Revert removes MaxQ-owned desktop/helpers/dockitem and the `$HOME/bin/ghostty` MaxQ-owned binary. It does not delete Mocha config if something else owns it; MaxQ-owned Ghostty config block is still reverted with theme.

## Launcher

Omarchy 4 (Quattro) merged Walker into a Quickshell Hyprland shell. That does not run here.

Bias: the **Walker-era** Omarchy launcher — fuzzy, icons, Super+Space.

1. Prefer Walker if a linux amd64 binary runs on this X11 GTK desktop.
2. Else install persist-safe **rofi** (Catppuccin Mocha) into `$HOME/bin` if the distro package is not already on PATH. Super+Space via xfce/xfwm keybind (home config, not `/usr`).

Launcher entries include:

- installed `.desktop` apps
- MaxQ shortcuts from `defaults.toml` (AI chat, web chat, Settings, Ghostty)

## Shortcuts (`defaults.toml`)

Persist at `$HOME/.config/maxq/defaults.toml`. Never bake a webhook or secrets. Example:

```toml
default_ai_chat = "chatgpt"   # chatgpt | grok | claude
[sites]
chatgpt = "https://chatgpt.com"
grok = "https://grok.com"
claude = "https://claude.ai"
discord = "https://discord.com/app"
slack = "https://app.slack.com/client"
```

First-run setup + Settings → Defaults can change these. Revert does not delete operator overrides.

Each site gets:

- a real icon PNG/SVG under `$HOME/.local/share/icons/maxq/`
- a `.desktop` on `$HOME/Desktop` and a plank dockitem
- `Exec` opens this-agent Chrome (`box-chrome` / current DISPLAY profile), never another agent's Chrome

Goal: one click from dock or Super+Space to the site, then computer-use starts.

## Settings

Thin page: default AI chat, chat-link list, launcher keybind, Ghostty status (installed / default / missing).

## Prove

`maxq prove` fails if Ghostty is not `$HOME/bin/ghostty` and not the default terminal helper, or if launcher + shortcut `.desktop` files are missing. Screenshots of dock, desktop icons, Super+Space launcher, and Ghostty window are the human proof.

See PLAN 7, 36–40.
