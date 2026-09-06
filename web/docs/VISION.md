# Vision — MaxQ as a co-operating system

This is the larger brand and product picture behind the hero. The launch canvas
only has room for two sentences per beat. The speech that produced those
sentences lives here, so later copy can stay aligned instead of collapsing
back into a feature list.

## Premise

MaxQ is a **co-operating system for the bot and you**.

You install it on the bot's computer. The stock box becomes a workstation
tailored for the bot — not a generic Linux image it has to figure out, and not
the machine Cursor or xAI shipped. You keep a side door onto that box.

Chat is a beautiful control surface because it is simple. It is a poor control
surface the moment something goes off the rails. Confidence that the bot is
doing what you think it is doing requires more than the transcript.

Two operators. One box.

## Three beats

The hero glass is three slides. Each slide keeps the same frame — **the bot
gets / you get** — and changes what those words mean.

### 01 · The bot's desk

The bot gets a computer tailored for it. Terminal, browser, desktops, theme,
and the CLIs and skills it ships with, in place before the first task. It does
not flounder. It does not need a week of onboarding. Dedicated computer-use
skills mean it already knows how to operate standard systems instead of
tripping over itself.

What you get is not "a desktop." What you get is a better assistant:

- Someone who does not have to be onboarded.
- Support from day one that can hit the ground running.
- An assistant that knows how to use a computer better than an intern does.
- Remote access onto that desk: Tailscale into the office, onto internal
  systems and hardware — a personalized internal assistant, on your network.
- Visibility into what it is doing: the desk is multiplexed through herdr, so
  you can join the session and watch the terminal, not just the chat.

The desk is designed for the bot. Because it is designed for the bot, you can
see it.

Do not say "a computer made for it" as if we designed the silicon. Cursor and
xAI made the computer. MaxQ tailored it.

### 02 · The side door

The desk gives the bot tools so it can work. The side door gives you tools so
you can control it.

Not a sidecar. A side door.

From the side door you can:

- Point the box at your own model router so the bot's allocation is not the
  thing that runs out first.
- See multiple desktops at once. The multiplexer is live Xvfb through noVNC.
  Nine (or fifteen) desktops on one sheet. Watch the work, not a log.
- Read telemetry. Preempt. If the shared box is out of RAM, kill the process.
- Run intelligent tasks against the bot box itself: a TUI on their system,
  reached through the settings web UI on loopback.
- Install skills from the bot marketplace, quickly, so the bot gets smarter
  without a prompt essay.

The bot gets stability, structure, steering, and therefore alignment. Because
you can steer it, the outputs come back more aligned. Because you can see the
box, a RAM problem is a RAM problem — not a mysterious "the AI is broken."

You get telemetry, visibility, and control.

### 03 · More tokens

Usage limits on Grok Bot are brutal. People run out. This is a sales pitch
because it is also true.

The bot gets more tokens. More tokens is more uptime. This gets Bot out of
jail.

You get more tokens. Constellation Router spends seats you already pay for
against the subscription efficiency frontier: how hard the job is, the
cheapest remaining token, and how close that seat is to reset.

The third slide is grounded in the OpenSecurity research note
[The Best AI Subscription Isn't the Best AI Model](#frontier) — reverse-
engineered quota economics across xAI, Anthropic, Google, OpenAI, and Z.AI.
The chart in the glass is that paper's comparable-spend frontier. Clicking it
opens the paper as a first-class page on this site.

Funny is allowed here, once: both columns start with "more tokens." Then they
diverge into why it matters.

## Voice

Short. Direct. Operator-register. Charge the speech with the premise, then get
precise. Do not list features and hope the reader infers the job.

The hyphen in **co-operating** is load-bearing. Two operators, not
"cooperating" as a vibe.

Prefer *tailored* over *made for*. Prefer *side door* over *sidecar*. Prefer
*steer* over *manage*. Prefer *the box* over *the instance*.

## What the launch canvas must not do

- Do not put a second hero in the glass. One shot at a time. Three captions.
- Do not type out the split. A short ripple is enough to show the copy
  changed; nobody should wait on it.
- Do not say "first product" in the eyebrow. MaxQ already appears in the
  wordmark and the kicker. The eyebrow names the relationship: one box, two
  operators.
- Do not steal the rocket's sky. Empty space on the right is the launch.

## Cue

This site was built agentically, including with Cue. When a screenshot needs
post — crop, overlay, callout, key — do it through Cue (`capturectl`), not a
one-off Python plate. If a Cue command is missing and that becomes the
hurdle, that is a product finding, not a reason to go around the tool.
