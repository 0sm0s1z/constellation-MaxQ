# How MaxQ gets built

1. Orchestrate with git/gh on grokbot (SSH: ~/.ssh/github-0sm0s1z).
2. Implement in ChatGPT web (Extra High) with the GitHub plugin on 0sm0s1z/constellation-MaxQ.
3. Fine-tune and test with local OpenCode (constellation-router/auto) and shell.

Do not put MaxQ in /usr. Persist under HOME. GOST is the proxy (MITM CA). Stay light, especially UI.

v0 configure/unconfigure: `maxq apply`, `maxq revert`, `maxq prove`, `maxq status`.
