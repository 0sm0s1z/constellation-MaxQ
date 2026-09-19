# Shareable skill packs

MaxQ ships installable bot skills. A pack is an opportunity for the box bot to
guide the operator. `maxq apply` installs the pack. It does not configure the
underlying product for the user.

## Install path

`install_skills` in `bin/maxq-core` installs **every** pack that has
`share/skills/<id>/SKILL.md`:

- `$HOME/.local/share/maxq/skills/<id>/SKILL.md`
- and, when `$HOME/agent-data/workflows` already exists, a mirror at
  `$HOME/agent-data/workflows/<id>/SKILL.md`

`<id>` is the pack directory name. Apply does not create `agent-data` if it is
absent. If the tree has no packs, apply warns and continues; it does not fail.

## Herdr (#124)

First shareable. Source: `share/skills/herdr/SKILL.md`.

Use it when the operator asks about Herdr panes, tabs, agents, or workspaces.
MaxQ also installs the `herdr` CLI into `$HOME/bin` when an official linux
amd64 artifact exists (see [CLIS.md](CLIS.md)). It does not write Herdr config,
start a server, or attach a session.

In-pane agents must see `HERDR_ENV=1` before they run control commands. An
orchestrator outside a pane may use `herdr --session <name>` without that
variable. Release-matched command details: `herdr --skill` on the installed
binary.

The pack does not bake household paths, SSH targets, or keys.

## Other packs

Tailscale/Headscale setup lives at
`share/skills/tailscale-setup-maxq-self-serve` and uses the same installer.
Behavior of that walkthrough is documented in
[NETWORK.md](NETWORK.md#bot-skill-self-serve-walkthrough).
