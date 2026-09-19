# Theme, wallpaper, dark mode

MaxQ ships Catppuccin Mocha. Latte is reserved; apply currently installs dark mode only.

## Applied under `$HOME`

- Wallpaper: `$HOME/.local/share/backgrounds/maxq/mocha.png`
- GTK theme: `$HOME/.local/share/themes/MaxQ-Catppuccin-Mocha`
- Cursors: `$HOME/.local/share/icons/MaxQ-Catppuccin-Mocha`
- GTK settings: `$HOME/.config/gtk-3.0/settings.ini` and `gtk-4.0/settings.ini`
- Ghostty config: `$HOME/.config/ghostty/config`
- Chrome theme files: `$HOME/.local/share/maxq/chrome-theme-mocha`

MaxQ writes owned blocks where configuration is shared. Revert removes those blocks and owned files.

## Browser theme

Chrome theme files are staged but not force-applied. MaxQ does not set browser flags or write managed policy. Load the unpacked theme or install the official Catppuccin Mocha theme from the Chrome Web Store.

## Ghostty

MaxQ configures Ghostty but does not install a Linux amd64 binary. Put a compatible `ghostty` binary in `$HOME/bin`; the Mocha configuration will apply.
