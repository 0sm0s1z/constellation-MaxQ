# Triggers and hooks

The computer alerts the bot. The webhook URL is dynamic and is **never** baked into the repo or the installer.

## Dest

Persist at `$HOME/.config/maxq/hooks.toml`:

```toml
webhook_url = ""   # empty = hooks disabled
```

Set it twice:

1. First-run setup skill (PLAN 24): ask for the URL (a Grok Bot webhook-routine URL, or any HTTPS POST dest).
2. Settings → Triggers: view, rotate, clear.

Revert does not delete `hooks.toml`.

## Trigger kinds

User-visible. Thin.

| kind | fires when |
|---|---|
| `schedule` | cron in the operator timezone (America/Los_Angeles here) |
| `probe` | a persist-safe shell command exits 0 (true). Non-zero stays quiet. stdout may be the message |

Later kinds stay the same shape: `{ id, kind, spec, hook, enabled }`.

## Hook

On fire, POST JSON to `webhook_url`:

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

No secrets in the payload. If the URL is empty, do not POST.

Cooldown per trigger so a stuck true probe cannot hammer the bot.

## Builtin: resource.mem

Probe `MemAvailable` / used percent (this computer has no swap). Default trip: available under 512 MiB or used ≥ 90%. Message: `warning resource limits exhausted: OOM`.

Settings resource page (PLAN 31) is the live view; this trigger is the alert.

## Runtime

Persist-safe `$HOME/bin/maxq-hooks` (or herdr later, PLAN 10). Loopback API can list/test/enable. Nothing in `/usr`. PID1 is tini; do not assume systemd timers.

See PLAN 32–35.
