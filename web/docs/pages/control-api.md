# Control API

The MaxQ control API is a loopback-only HTTP service with an embedded settings sheet.

- Binary: `$HOME/bin/maxq-api`
- Listen: `127.0.0.1:7432`
- UI: `http://127.0.0.1:7432/`
- PID file: `$HOME/.config/maxq/api.pid`

`maxq apply` starts the process. `maxq revert` stops it. The server refuses `0.0.0.0`, `::`, and private-network binds. There is no authentication beyond localhost.

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/` | Thin settings sheet. |
| `GET` | `/status` | Applied state, theme, GOST state, and CLIs. |
| `POST` | `/apply` | Runs `maxq apply`. |
| `POST` | `/revert` | Runs `maxq revert`, returns, then exits. |
| `POST` | `/proxy` | Updates `{enabled, upstream, iface}` for the GOST process. |

## Example

```bash
curl -fsS http://127.0.0.1:7432/status
curl -fsS -X POST http://127.0.0.1:7432/apply
```

The implementation source is `cmd/maxq-api`; the canonical reference remains repository `docs/API.md`.
