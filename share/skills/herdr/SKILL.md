---
name: herdr
description: >-
  Use when asked to inspect or control Herdr panes, tabs, agents, or
  workspaces. Bot-guided self-serve (this skill + the herdr CLI on the box);
  never configure Herdr for the user; never bake household paths, SSH targets,
  or keys. In-pane agents require HERDR_ENV=1; an orchestrator may use
  `herdr --session <name>` outside that env.
---
# Herdr (MaxQ self-serve)

## When to use
When an operator asks the MaxQ bot to use **Herdr** — panes, tabs, agents, or
workspaces — or to show how those controls work on this box. Do not use this
skill merely because a task could use a background terminal.

## Principle
MaxQ creates the **opportunity**. It does **not** configure Herdr for the user.

- `maxq apply` installs this skill.
- The same apply puts the `herdr` CLI on the box (`$HOME/bin`) when an official
  linux amd64 artifact exists (see `docs/CLIS.md` in the MaxQ repo).
- MaxQ does not write Herdr config, start or stop `herdr server`, create a
  session, or attach the TUI for the operator.

Guide. The operator decides session names, layout, and which panes are theirs.

Command syntax and lifecycle details that move with the release come from the
installed binary, not from this pack:

```bash
herdr --skill
```

If this file and `herdr --skill` disagree, follow the binary.

## Where you are running

**In-pane agents** (a coding agent already inside a Herdr pane) must confirm
the pane environment before any control command:

```bash
test "${HERDR_ENV:-}" = 1
```

If that check fails, say you are not inside a Herdr pane and stop. Do not
target whatever pane the UI happens to focus.

**Orchestrators** (driving Herdr from outside a pane) may run
`herdr --session <name>` without `HERDR_ENV=1`. That is expected. Put
`--session <name>` on every command so you hit the session the user named, not
the focused TUI. Do not invent a session, host, or SSH target. Do not treat
another household's Herdr as this box.

## Learn the current CLI

Start with help. Do **not** run bare `herdr` to discover commands — that
launches or attaches the TUI.

```bash
herdr --help
```

Print a command group by invoking the group with no subcommand (add
`--session <name>` when you are the orchestrator):

```bash
herdr agent
herdr pane
herdr workspace
herdr tab
herdr session
```

Same pattern for other groups (`herdr worktree`, `herdr notification`,
`herdr integration`). Do not probe a mutating command by dropping its
arguments. `herdr workspace create` and similar are valid with defaults and
**will execute**.

## IDs come from JSON

Most control commands return JSON. Read workspace, tab, and pane ids from that
response. Do not guess from sidebar order, and do not reuse example ids from
this file.

Public shapes look like `w1` (workspace), `w1:t1` (tab), `w1:p1` (pane). Closed
ids are not reused. After `pane move`, continue with the new pane id in the
response (`.result.move_result.pane.pane_id`), not the previous one.

Prefer `--current` when a pane command should hit the calling pane. Omitting a
target can hit the UI-focused pane, which may belong to the user or another
client.

`pane split` returns the new pane as `.result.pane` (id at
`.result.pane.pane_id`).

## Split, then start an agent

`agent start` needs an existing available shell pane: interactive prompt, shell
in the foreground, no foreground command or agent. It never creates, splits, or
moves layout. Split first.

Default to a sibling pane. Do not create a workspace, tab, worktree, or a
different working directory unless the user asked.

Keep the user's focus where it is. Background work uses `--no-focus`.

In-pane:

```bash
herdr pane split --current --direction right --cwd "$PWD" --no-focus
```

Orchestrator (outside the pane; session and source pane the user named):

```bash
herdr --session <name> pane split --pane <existing-pane-id> --direction right --no-focus
```

Use `down` instead of `right` when the user asked, or when the source pane is
narrow or tall (`herdr pane layout`). Then start only the agent kind the user
asked for. Names match `[a-z][a-z0-9_-]{0,31}` and must be unique among live
agents. Run `herdr agent` for the installed `--kind` list. Arguments for the
agent itself go only after `--`:

```bash
herdr agent start <name> --kind <kind> --pane <returned-pane-id>
```

Orchestrator form adds `--session <name>` before the group. A successful
`agent start` returns when Herdr sees that agent ready for input. If startup
returns blocked, wait until idle and ask the user before answering an approval.
Submit work with `herdr agent prompt`. Do not answer a blocked approval UI
unless the user asked.

Ordinary commands use the pane surface after the same split, still with the
id you parsed:

```bash
herdr pane run <returned-pane-id> "<command>"
```

## Safety
- `--no-focus` unless the user asked to switch their focus.
- Target `--current`, an explicit pane id, or a unique agent name. Do not act
  on another client's focused pane by default.
- Do not close panes, tabs, workspaces, or sessions you did not create unless
  the user explicitly asked.
- Never run `herdr server stop` unless the user explicitly asked to stop the
  server and its pane processes. Never kill the Herdr process.
- CLI server errors are JSON on stderr (exit 1). Syntax errors exit 2.

## Hard bans
- Never bake a household's home paths, hostnames, SSH targets, or keys into
  skills, docs, or commands
- Never paste secrets or a machine-specific session map into chat as a recipe
- Never treat a staff or fleet bot's Herdr session as the user's session
- Never configure Herdr for them (white-glove). Guide; they decide

## Install location
`maxq apply` installs this skill to:
- `$HOME/.local/share/maxq/skills/herdr/SKILL.md`
- and, when present, `$HOME/agent-data/workflows/herdr/SKILL.md`

## Prove bar
Prove checks this pack is installed. It does not join a session, open the TUI,
or stop a server.
