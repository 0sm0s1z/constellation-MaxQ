---
name: herdr
description: >-
  Control Herdr, a terminal multiplexer for coding agents. Use only when the
  user explicitly mentions Herdr or asks to use Herdr to inspect or control
  panes, tabs, workspaces, commands, or another agent. Do not use merely
  because a task could benefit from a background terminal, delegation, or
  parallel work. Requires HERDR_ENV=1. Release-matched details: `herdr --skill`.
---
# Herdr (MaxQ shareable)

Herdr organizes terminals into workspaces, tabs, and panes, recognizes coding
agents inside panes, and exposes the current session through the `herdr` CLI.

## Principle
MaxQ ships the **opportunity** — this installable skill plus `herdr` on PATH.
It does **not** configure Herdr layouts or agents for the operator.

## When to use
Only when the operator explicitly asks about **Herdr** (panes, tabs, workspaces,
agent control). First shareable tile target: issue #124 / parent #123.

## Guard
Before any control command, verify this agent is inside a Herdr-managed pane:

```bash
test "${HERDR_ENV:-}" = 1
```

If that fails, say you are not inside Herdr and stop. Do not drive the focused
Herdr session from outside Herdr.

## Learn the current CLI
The installed binary is authority:

```bash
herdr --help
herdr --skill
herdr agent
herdr pane
herdr workspace
herdr tab
```

Do **not** run bare `herdr` for discovery (launches/attaches the TUI). Do not
probe mutating nested commands by omitting args. Most control commands return
JSON — parse IDs from responses.

## Layout vs agents
- Workspace / tab / pane = topology
- Pane commands = raw terminals, shells, tests, servers
- Agent commands = recognized coding-agent lifecycle (`idle` / `working` /
  `blocked` / `done` / `unknown`)

`agent start` requires an existing available shell pane and never creates
layout. Split first (`pane split`), then start.

Public IDs: workspace `w1`, tab `w1:t1`, pane `w1:p1`. Closed IDs are not reused.

## Split then start (typical)

```bash
herdr pane split --pane "$HERDR_PANE_ID" --direction right --cwd "$PWD" --no-focus
# read .result.pane.pane_id
herdr agent start <name> --kind <kind> --pane <new-id> -- <agent-args...>
herdr agent prompt <name> "..." --wait
```

Prefer unique names matching `[a-z][a-z0-9_-]{0,31}`. Use `--no-focus` for
background work. Exact flags follow `herdr --skill` / `--help` on this box.

## Coordinate

```bash
herdr agent list
herdr agent read <target> --source recent-unwrapped --lines 120
herdr agent wait <target> --until idle --timeout 120000
herdr pane run <pane-id> "command"
herdr pane wait-output <pane-id> --match "text" --timeout 120000
```

## Safety
- Do not close panes/tabs/workspaces you did not create unless asked
- Never stop the Herdr server unless explicitly requested
- Parse JSON IDs; do not invent them from sidebar order
- Keep a shell pane available for host builds/tests

## Hard bans
- Never bake household hostnames, SSH keys, pane maps, or staff-box recipes into
  skills, docs, or proves
- Never treat a staff Constellation Herdr session map as product SoT
- Never collect secrets into chat or skill bodies

## Install location
`maxq apply` installs this skill to:
- `$HOME/.local/share/maxq/skills/herdr/SKILL.md`
- and, when present, `$HOME/agent-data/workflows/herdr/SKILL.md`

## Prove bar
Tester proves the pack installs with `maxq apply` and remains a self-serve
shareable — not a white-glove drive of a specific staff machine.
