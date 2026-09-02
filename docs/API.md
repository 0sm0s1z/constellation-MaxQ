# MaxQ control API

Loopback-only HTTP API plus a thin Catppuccin Mocha settings sheet.

- Binary: `$HOME/bin/maxq-api` (built from `cmd/maxq-api` on apply)
- Listen: `127.0.0.1:7432` (or loopback `listen` in `$HOME/.config/maxq/api.toml`)
- UI: `http://127.0.0.1:7432/` (embedded `cmd/maxq-api/ui`)
- Pidfile: `$HOME/.config/maxq/api.pid`

`maxq apply` starts the process; `maxq revert` stops it. The binary and `api-src` cache are kept across revert (like GOST / CA). Non-loopback binds are refused. Mutating browser requests must have a matching local Origin; local clients such as curl may omit Origin. MaxQ never writes Chrome `ProxyMode`/`ProxyServer` or `cxn-egress.json`.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/status` | applied/reverted, theme, GOST enabled/running, API listen |
| POST | `/apply` | delegates to `maxq apply` |
| POST | `/revert` | delegates to `maxq revert`, returns, then API exits |
| POST | `/proxy` | JSON `{ "enabled": true|false }` — GOST process only |
| GET | `/` | thin settings sheet: status, apply/revert, proxy on/off |

The API deliberately does not expose GOST upstream/interface/intercept controls or any Chrome proxy control. Those remain CLI/config concerns.

## Sheet source

TypeScript: `cmd/maxq-api/ui/sheet.ts` (no framework). Served file is `sheet.js`.
