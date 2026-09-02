---
name: maxq-setup
description: Configure constellation-MaxQ first-run and post-update settings, especially the dynamic trigger webhook destination. Use when setting up MaxQ, reviewing MaxQ configuration after an update, or when the operator needs to enable, rotate, clear, or verify trigger webhook delivery without baking a URL into code.
---

# MaxQ Setup

Keep setup persist-safe under `$HOME`. Do not write setup state to `/usr` or the repository.

1. Read `$HOME/.config/maxq/hooks.toml` if it exists.
2. If `webhook_url` is empty or missing, ask the operator exactly: **What HTTPS webhook URL should MaxQ use for trigger notifications? Leave it blank to keep hooks disabled.**
3. Never invent, infer, or ship a webhook URL. Blank means disabled.
4. If the operator supplies a URL, require HTTPS. Prefer the loopback Settings > Triggers API (`POST /triggers/webhook`) when `127.0.0.1:7432` is available; otherwise persist only `webhook_url = "..."` in `$HOME/.config/maxq/hooks.toml` with user-only permissions.
5. After a MaxQ update, run `maxq apply` and verify the existing `hooks.toml` value was preserved.
6. Do not enable GOST as part of setup. Do not create Chrome CONNECT/proxy policy, `cxn-egress.json`, or `/tmp/sand-egress-proxy`.
