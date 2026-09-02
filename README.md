# constellation-MaxQ

**Take your Grok Bot to MaxQ.**

One command turns the stock computer into a fully-equipped agent workstation.

```bash
curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash
```

From a checkout:

```bash
./install.sh
maxq status          # applied | reverted
maxq apply           # configure (idempotent)
maxq revert          # unconfigure MaxQ-owned files only
maxq prove           # revert/apply/assert cycle; leaves APPLIED
```

Persist under `$HOME` (`bin`, `.config/maxq`, `.local`). Theme default is Catppuccin Mocha. GOST is a stub (`enabled = false`) until the operator enables it. Revert never deletes `$HOME`, SSH keys, or Chrome logins.

MaxQ is the point where your bot computer is fully loaded, configured, and operating at its limit.
