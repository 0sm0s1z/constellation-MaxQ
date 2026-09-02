# Triggers and hooks

The computer alerts the bot. The webhook URL is dynamic and is **never** baked into the repo or installer.

## Destination

Persist at `$HOME/.config/maxq/hooks.toml` with mode `0600`:

```toml
webhook_url = ""   # empty = hooks disabled
```

Settings → Triggers can set, rotate, test, or clear the destination. The control API never returns the full URL; it returns only a redacted `https://host/…` hint so tokenized webhook paths are not exposed through status or UI.

A future first-run setup skill (PLAN 24) may collect the same URL. Revert does not delete `hooks.toml`, `triggers.json`, or `triggers-state.json`.

## Trigger kinds

User-visible and thin.

| kind | fires when |
|---|---|
| `schedule` | five-field cron matches in `America/Los_Angeles` |
| `probe` | a persist-safe `/bin/sh -c` command exits 0 |

Definitions persist in `$HOME/.config/maxq/triggers.json`. Runtime state, including last attempt and last successful fire, persists in `$HOME/.config/maxq/triggers-state.json`.

Shell-probe stdout/stderr are discarded. MaxQ sends a generic probe message instead of forwarding command output, which prevents accidental secret disclosure from probe output.

## Hook

On fire, POST JSON to the configured HTTPS destination:

```json
{
  "source": "maxq",
  "trigger": "resource.mem",
  "level": "warning",
  "message": "warning resource limits exhausted: OOM",
  "host": "grokbot",
  "facts": {}
}
```

No webhook URL, shell output, credentials, or tokens are copied into the payload. If the URL is empty, no trigger commands are evaluated and nothing is posted.

Cooldown is tracked per trigger using `last_attempt`, so a stuck true probe or failed webhook cannot hammer the bot.

## Builtin: `resource.mem`

The builtin probe is visible in Settings → Triggers and enabled by default. It reads Linux `/proc/meminfo` and fires when either:

- `MemAvailable` is below 512 MiB, or
- used memory is at least 90%.

The message is exactly `warning resource limits exhausted: OOM`. The default cooldown is 15 minutes. This computer has no swap; the payload includes `swap_total_bytes` as a fact rather than assuming swap exists.

Settings → Resources is the live view; this trigger is the alert.

## Runtime

PLAN 32–35 run as a worker goroutine inside the existing persist-safe `$HOME/bin/maxq-api` process. That means the existing `maxq apply` / `maxq revert` API lifecycle also starts and stops trigger evaluation without adding systemd, cron daemons, or anything under `/usr`. PID1 remains `tini` and is not used for supervision.

The loopback API supports:

- `GET /triggers`
- `POST /triggers/webhook`
- `POST /triggers/add`
- `POST /triggers/enable`
- `POST /triggers/test`

All state remains under `$HOME/.config/maxq`. A later herdr integration (PLAN 10) can split supervision without changing the trigger definition shape.
