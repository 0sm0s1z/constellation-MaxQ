# MaxQ operator CLIs

`maxq apply` installs official **linux amd64** binaries or scripts into `$HOME/bin` when they exist. A missing tool does **not** fail apply; it is recorded in `$HOME/.config/maxq/clis.txt` and `[clis]` in `maxq.toml`.

| Tool | Command | Source | Notes |
| --- | --- | --- | --- |
| herdr | `herdr` | GitHub `herdrdev/herdr` latest `herdr-linux-x86_64` | |
| Vercel fx | `fx` | GitHub `vercel-labs/fx` `fx-linux-x86_64.tar.gz` | |
| Grok CLI | `grok` | `https://x.ai/cli/grok-<ver>-linux-x86_64.gz` | |
| Codex CLI | `codex` | GitHub `openai/codex` `codex-x86_64-unknown-linux-musl.tar.gz` | |
| Claude Code | `claude` | `downloads.claude.ai` `linux-x64/claude` | |
| OpenCode | `opencode` | GitHub `anomalyco/opencode` `opencode-linux-x64.tar.gz` | Installs when absent; never overwrites an external (non-owned) copy |
| Tailscale | `tailscale` | `pkgs.tailscale.com` `tailscale_latest_amd64.tgz` | Installs when absent; never overwrites an external (non-owned) copy (EVA Headscale hop) |

PATH is prepended via the MaxQ profile snippet (`$HOME/bin`). Downloads cache under `$HOME/.config/maxq/cli-cache` and survive revert (like the CA).

## Ownership / revert

Newly installed CLIs are marked in `$HOME/.config/maxq/managed-clis/<name>`. `maxq revert` deletes **only** those MaxQ-owned binaries — including MaxQ-owned OpenCode and Tailscale. External (non-owned) copies already in `$HOME/bin` are not claimed, not overwritten, and not deleted (`cli_maybe_keep` / non-clobber). The API/toml `preexisting` status field reports those external keeps. Revert never deletes `$HOME`, `~/.ssh`, or Chrome profiles.

If a tool has no linux amd64 binary, apply skips it and documents the skip.
