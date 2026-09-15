# MaxQ Actions

Ground-up operator intent. Not a pile of STREAM buttons.

An **Action** is a named intent the glass can fire. The website never shells the box.
It POSTs `/actions/{id}/run`. The Go API dispatches a runner and the glass watches
`/actions/runs/{id}`.

## Shape

- `id` — stable slug (`clear-ram`)
- `label` — button copy
- `kind` — `prompt` | `webhook` | `local`
- `scope` — `box` | `desktop` | `fleet`
- `runner` — `opencode` (local) | `webhook` (CXN-Control, FaaS, …)
- `binds` — surfaces that may show it (`stream.ram`, `stream`, `crew.desktop`)
- `prompt` — for `kind=prompt` (OpenCode gets this verbatim)
- `webhook` — for `kind=webhook` (empty = catalogued, not armed)

## Runners

1. **prompt / opencode** — `$HOME/bin/opencode run -m constellation-router/auto -- <prompt>`
2. **webhook** — POST JSON `{action, scope, display, host}` to the configured URL

Results stream back as a run card (`queued` → `running` → `ok` | `error`).

## First binds

- `clear-ram` → STREAM RAM tile + Crew panel (`crew.desktop`) (prompt)
  - Protect the *current* operator desktop (whatever `/desktops` marks current); never hardcode `:5` / `chrome-profile-5`. Never kill `maxq-api`, `gost`, or live/busy desks.
- `close-idle-tabs` → STREAM (fleet webhook, unarmed until CXN-Control URL is set)
- `ensure-novnc` → STREAM + Crew (`crew.desktop`) (local)
  - Start websockify for live desks that already have x11vnc but no viewer yet.
- `resume-paused` → STREAM + Crew (`crew.desktop`) (local)
  - SIGCONT all live desks marked frozen/paused, except the current agent display.
  - Glass uses confirm-armed copy (`Confirm resume N frozen?`) so mass wake is obviously gated.
  - Do not auto-fire overnight — frozen desks may be intentional RAM relief.

Password still first OSS lock. Until then, treating EVA `:7432` as the operator.

- `freeze-quiet-desks` → STREAM RAM + Crew (`crew.desktop`) (local, armed)
  - SIGSTOP non-current idle/quiet desks. Skips current agent, busy desks, already frozen.
  - Glass should confirm (`Confirm freeze N quiet?`). **Never auto-fire** overnight.
- `report-ram` → STREAM RAM + Crew (local, armed)
  - Read-only `/proc/meminfo` JSON in the run detail (available/used/total + swap note).
- `restart-websockify-only` → STREAM + Crew (local, armed)
  - Restart websockify/noVNC only. Never kills Xvfb, Chrome, or x11vnc.

## OOM / swap note

Box swap is typically **0**. Prefer Actions (report-ram → freeze-quiet / Clear RAM) over enabling swap.
**Do not enable swap without Matthew.**

## Glass OOM bands (Home + Desktops STREAM)

- **Elevated (≥65%)**: Home surfaces Report RAM + Freeze quiet; Desktops RAM tile gets `elevated` styling.
- **Critical (≥85%)**: Home unlocks Clear RAM CTA; Desktops STREAM / Crew also show Clear RAM (hidden below 85%).
- Never auto-fire Clear RAM, Freeze quiet, or Resume paused.
- Glass labels match counts: Home/STREAM/Actions show `Freeze N quiet` and `Resume N frozen` (from live `/desktops` system).
- **Actions catalog** (`/actions.html`): same Clear RAM Run gate (≥85%); shows RAM % + OOM band strip. Catalog cards stay visible when locked.
- **Home** surfaces a locked `Clear RAM · locked` CTA at elevated (≥65%) so the catalog gate is visible before critical; Run remains Actions-only at ≥85%.
