# How MaxQ gets built

1. Orchestrate with git/gh on grokbot (SSH: ~/.ssh/github-0sm0s1z).
2. Implement in ChatGPT web (Extra High) with the GitHub plugin on 0sm0s1z/constellation-MaxQ.
3. Fine-tune and test with local OpenCode (constellation-router/auto) and shell.

Do not put MaxQ in /usr. Persist under HOME. GOST is the local CONNECT proxy; MITM CA is generated under `$HOME/.config/maxq/ca` with intercept off by default. MaxQ never writes Chrome `ProxyMode`/`ProxyServer`. Stay light, especially UI.

v0 configure/unconfigure: `maxq apply`, `maxq revert`, `maxq prove`, `maxq status`, `maxq proxy`.

Control API: Go stdlib binary `maxq-api` (`cmd/maxq-api`), loopback `127.0.0.1:7432`, with operator/desktops views when the richer API runtime is installed. apply starts it; revert stops it.

Theme is Catppuccin Mocha under `$HOME/.local/share` and `$HOME/.config`. Ghostty is configured through MaxQ desktop composition. Chrome theme activation remains HOME-only and never uses managed Chrome proxy policies. Operator CLIs install into `$HOME/bin` from official linux amd64 releases; missing tools are skipped and listed in `clis.txt`. OpenCode, Tailscale, and tailscaled are MaxQ-managed desired state; there is no legacy preexisting keep path.
