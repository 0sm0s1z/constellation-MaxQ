---
name: Tailscale setup (MaxQ self-serve)
description: >-
  Use for Tailscale/Headscale MaxQ setup — bot-guided self-serve walkthrough
  (settings sheet + this skill); never configure for the user; never bake a
  household's home paths or keys; prove both UI and skill paths.
---
# Tailscale / Headscale setup (MaxQ self-serve)

## When to use
When an operator asks the MaxQ bot to connect this machine to **Tailscale** or
**Headscale**, or when proving ACCESS/network setup (issue #93, prove #84 / P01b).

## Principle
MaxQ creates the **opportunity** for simple setup — it does **not** configure the
network for the user.

Two valid paths (both must exist for prove):
1. **UI** — MaxQ settings sheet → Network → Save & join
2. **Bot skill** — this walkthrough when the user asks the bot

## Bot walkthrough
Guide the operator; they click and type:
1. Pick **Tailscale** vs **Headscale**
2. If Headscale: set `login_server` (their control server URL)
3. Auth / preauth key **via the MaxQ sheet only** — never paste secrets into chat
4. For Headscale: confirm the key carries any **ACL tags** their admin requires
   (untagged keys can show Connected with 0 peers)
5. **Save & join**
6. Verify status (joined / connected / auth key stored)
7. Show **Leave / Disconnect** and **Clear stored key** if rotating keys

## Hard bans
- Never bake a specific household's home paths, hostnames, or personal keys into
  skills, docs, or proves
- Never collect auth keys into chat, memory, or skill bodies
- Never “join for them” as white-glove ops
- Never treat a staff bot's Tailscale session as a substitute for product self-serve

## Install location
`maxq apply` installs this skill to:
- `$HOME/.local/share/maxq/skills/tailscale-setup-maxq-self-serve/SKILL.md`
- and, when present, `$HOME/agent-data/workflows/$SKILL_ID/SKILL.md`

## Prove bar
Tester proves **both** the UI path and “ask bot → guided setup” path exist and stay
simple — not operators joining a specific home or collecting keys.
