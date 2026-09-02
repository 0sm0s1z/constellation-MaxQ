# MaxQ control API

Loopback-only HTTP API plus a thin Catppuccin Mocha settings sheet. Not an admin suite.

- Binary: `$HOME/bin/maxq-api` (built from `cmd/maxq-api` on apply)
- Listen: `127.0.0.1:7432` (or `listen` in `$HOME/.config/maxq/api.toml`)
- UI: `http://127.0.0.1:7432/` (embedded `cmd/maxq-api/ui`)
- Pidfile: `$HOME/.config/maxq/api.pid`
- Hook config: `$HOME/.config/maxq/hooks.toml` (empty URL disables hooks; preserved across revert)
- Trigger state: `$HOME/.config/maxq/triggers.json`

`maxq apply` starts the process; `maxq revert` stops it. The binary and `api-src` cache are kept across revert (like gost / CA). Bind is refused for `0.0.0.0`, `::`, and `10.0.0.0/16`. No auth beyond localhost. MaxQ never writes Chrome `ProxyMode`/`ProxyServer`, `cxn-egress.json`, or `/tmp/sand-egress-proxy`.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/status` | desired state, Mocha theme, GOST, CLI inventory, thin-page stubs |
| POST | `/apply` | runs `maxq apply` |
| POST | `/revert` | runs `maxq revert` (API exits) |
| POST | `/proxy` | JSON `{enabled, upstream, iface}` — GOST process only |
| GET | `/resources` | host RAM/CPU and per-display/profile Chrome RSS |
| POST | `/resources/chrome` | `{action:"trim"|"restart"}` for this agent only; target is derived from `DISPLAY=:N` + `$HOME/chrome-profile-N` |
| GET | `/triggers` | webhook state plus trigger list/enable/last-fire |
| POST | `/triggers` | add `schedule` cron or `probe` shell-exit-0 trigger |
| POST | `/triggers/enable` | `{id,enabled}` |
| POST | `/triggers/test` | fire one trigger through the configured webhook |
| POST | `/triggers/webhook` | set/rotate/clear HTTPS webhook URL |
| GET | `/` | thin settings pages: theme, proxy, firewall, vault, OAuth, skills, resources, triggers |

Firewall, vault, OAuth, and skills remain deliberately thin placeholders for their later implementation plans. Theme remains Mocha only. GOST remains default-off.

## Resource safety boundary

The API can observe all Chrome groups on the shared host, but mutation never accepts an agent/display/profile parameter. It derives the current agent from its own `DISPLAY=:N` and exact `$HOME/chrome-profile-N`; processes outside that pair are observe-only. `trim` signals only matching renderer processes. `restart` signals only matching Chrome processes and relaunches the matching browser root when available.

## Trigger semantics

See `docs/TRIGGERS.md`. `schedule` uses five-field cron in `America/Los_Angeles`. `probe` runs a persist-safe shell command and fires only on exit 0. Delivery is JSON `{source, trigger, level, message, host, facts}`. The builtin `resource.mem` trips below 512 MiB available or at 90% used and sends `warning resource limits exhausted: OOM` with cooldown.

## Sheet source

TypeScript: `cmd/maxq-api/ui/sheet.ts` (no framework). Served file is `sheet.js`.
