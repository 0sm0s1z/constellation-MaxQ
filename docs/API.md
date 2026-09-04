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
| GET | `/connections` | Saved connection metadata; auth values are never returned |
| POST | `/connections` | JSON `{name, base_url, auth?}`; stores one remote MaxQ API |
| DELETE | `/connections/{id}` | Remove a saved remote API |
| GET | `/desktops` | Returns local X11 desktops and concurrently aggregates `GET /desktops` from every connection |
| POST | `/desktops/action` | JSON `{connection_id, desktop_id, action, payload?}`; routes to the owning API |
| GET | `/` | thin settings sheet (status, connections, aggregate desktops, proxy) |

Vault, OAuth, and skills are placeholders for later pages.

## Sheet source

TypeScript: `cmd/maxq-api/ui/sheet.ts` (no framework). Served file is `sheet.js`.

## Multi-API connections

Connections are stored in `$HOME/.config/maxq/connections.json` with mode `0600`. The `auth` request field is treated as a bearer token unless it already contains an authorization scheme; it is sent only to that connection and is represented in list responses by `auth_configured`.

The local provider discovers X11 displays under `/tmp/.X11-unix` (and honors an inventory-shaped `desktops.json` when supplied by the desktop runtime), adding VNC/noVNC metadata without making an HTTP request to itself. The desktop aggregator includes that local inventory and queries all saved APIs concurrently. Each returned desktop is enriched with `connection_id`, `connection_name`, `source_api`, and `box_identity`; identity is taken from the desktop, then the response (`box_identity`, `identity`, or `hostname`), and finally the saved connection name. A failed connection is reported in `errors` without hiding desktops from healthy boxes.

Connected APIs should return either an array of desktop objects or `{"box_identity": "...", "desktops": [...]}`. Actions use the remote `POST /desktops/{desktop_id}/action` endpoint and carry `{action, payload}`.
