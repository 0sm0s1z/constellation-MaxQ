# Agents — constellation-MaxQ

GitHub `0sm0s1z/constellation-MaxQ` is the source of truth. Read this file before changing the installer or site.

## Repository lanes

| Path / branch | Purpose |
| --- | --- |
| Repo root / `main` | MaxQ installer |
| `web/` / `web/maxq-site` | Marketing site production line |
| `web/*` | Site pull-request branches |
| `plan-*` | Installer tasks |

Keep installer and site work in their lanes. Do not merge unless Matthew says.

## Installer rules

- Persist only under `$HOME`.
- Stay off `10.0.0.0/16`.
- Never write Chrome `ProxyMode` or `ProxyServer` policy.
- Never restore `cxn-egress.json` unless Matthew asks.
- After `browserUse` / `computerUse` browser automation, run `maxq tabs prune --task-url <active-task-url>` when the active task URL is known. This keeps at most one task-host tab plus optional ChatGPT and GitHub tabs, while failing soft if the current-display CDP endpoint is unavailable. Without a task URL, `maxq tabs prune` is intentionally conservative and only removes duplicate or blank/new-tab pages.
- Do not call tab pruning from `maxq apply` or reconciliation: those lifecycle paths do not know which browser tab is task-relevant.

## Site rules

Before touching `web/`, read `web/AGENTS.md` and `web/docs/`.

The live site must come from committed work in this repository. `/workspace/maxq-web` is a leftover non-git editing folder, not canonical. The production Vercel project is **maxq**, not **maxq-site**.

SSH key for this repository: `~/.ssh/github-0sm0s1z`.
