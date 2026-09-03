# Grok Bot contract

## Seating

- Grok Bot orchestrates `git` and `gh`; it owns branch, proof, and handoff.
- ChatGPT web implements in **Chat mode only**, Extra High, with the GitHub plugin.
- The local pass fine-tunes, builds, and verifies.

Never use Work mode. Never click **Turn on auto-reload** or the workspace-out-of-credits path.

## Default loop

1. Use `web/maxq-site` as the production line and `web/*` for site PRs.
2. Orchestrate on Grok Bot with repo `0sm0s1z/constellation-MaxQ` and key `~/.ssh/github-0sm0s1z`.
3. Implement in ChatGPT web under the seating above.
4. Fine-tune locally; run the `web/` build and verify assets.
5. Commit and push. Do not merge unless Matthew says.
6. Report branch, SHA, build result, deployment project, URL, and asset checks.

Persist only `$HOME`. Stay off `10.0.0.0/16`. Never write Chrome `ProxyMode` or `ProxyServer`. Never restore `cxn-egress.json` unless Matthew asks.

## Image generation

Continue the existing **CONSTELLATION / MaxQ** ChatGPT thread. Save approved output under `public/art/`, reference it from source, and commit both. Do not source new work from `public/art/desk.webp`; replace that image.
