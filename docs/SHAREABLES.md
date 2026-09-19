# MaxQ shareable skill packs

MaxQ installs bot skills from `share/skills/<id>/SKILL.md` on `maxq apply` into:

- `$HOME/.local/share/maxq/skills/<id>/SKILL.md`
- and, when present, `$HOME/agent-data/workflows/<id>/SKILL.md`

Packs are **self-serve opportunity** — MaxQ does not configure the operator’s
tools for them. Site shareable tiles (#123) should link these packs, not mocks.

## Current packs

| Id | Issue | Notes |
| --- | --- | --- |
| `tailscale-setup-maxq-self-serve` | #93 | Network join walkthrough; see [NETWORK.md](NETWORK.md) |
| `herdr` | #124 | Herdr layout/agent control; release SoT is `herdr --skill` on the box |

Constellation fleet overlays (for example remote `herdr --session` orchestrator
notes) stay in fleet `agent-data/workflows/` — they are **not** part of the MaxQ
share pack.

## Prove
`maxq prove` asserts each known pack’s `SKILL.md` is present under
`$HOME/.local/share/maxq/skills/`.
