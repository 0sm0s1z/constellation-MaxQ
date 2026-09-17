# CLIs and packages

MaxQ records the package inventory and installs selected operator CLIs into `$HOME/bin`. It does not mutate system packages.

## CLIs

Apply attempts to install official Linux amd64 builds for Herdr, Vercel fx, Grok CLI, Codex CLI, and Claude Code. A missing binary does not fail apply; the skip is recorded in `$HOME/.config/maxq/clis.txt` and `maxq.toml`.

OpenCode and Tailscale are preexisting tools. MaxQ does not overwrite or claim them.

## Ownership

Newly installed tools are marked under `$HOME/.config/maxq/managed-clis`. Revert deletes only marked MaxQ-owned binaries. Downloads remain cached under `$HOME/.config/maxq/cli-cache`.

## PATH

The MaxQ profile snippet prepends `$HOME/bin`. Check availability with:

```bash
maxq status
cat "$HOME/.config/maxq/clis.txt"
```

See repository `docs/CLIS.md` for current sources and archive names.
