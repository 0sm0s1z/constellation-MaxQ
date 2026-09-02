# MaxQ control API

Loopback-only HTTP API plus a thin Catppuccin Mocha settings sheet. Not an admin suite.

- Binary: `$HOME/bin/maxq-api` (built from `cmd/maxq-api` on apply)
- Listen: `127.0.0.1:7432` (or `listen` in `$HOME/.config/maxq/api.toml`)
- UI: `http://127.0.0.1:7432/` (embedded `cmd/maxq-api/ui`)
- Pidfile: `$HOME/.config/maxq/api.pid`

`maxq apply` starts the process; `maxq revert` stops it. The binary and `api-src` cache are kept across revert (like gost / CA). Bind is refused for `0.0.0.0`, `::`, and `10.0.0.0/16`. No auth beyond localhost. MaxQ never writes Chrome `ProxyMode`/`ProxyServer`.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/status` | `applied`/`reverted`, theme, gost enabled/running, clis |
| POST | `/apply` | runs `maxq apply` |
| POST | `/revert` | runs `maxq revert` (API exits) |
| POST | `/proxy` | JSON `{enabled, upstream, iface}` — GOST process only |
| GET | `/` | thin settings sheet (status, apply/revert, proxy on/off) |

Vault, OAuth, and skills are placeholders for later pages.

## Sheet source

TypeScript: `cmd/maxq-api/ui/sheet.ts` (no framework). Served file is `sheet.js`.
