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
maxq proxy           # GOST settings (local process only)
maxq proxy on|off
maxq proxy upstream <url>
maxq proxy iface <name>
```

Persist under `$HOME` (`bin`, `.config/maxq`, `.local`). Theme default is Catppuccin Mocha.

GOST (`$HOME/bin/gost`, go-gost) is the local CONNECT proxy. Default is `enabled = false` and `intercept = false` (no MITM). `maxq proxy on` starts gost with a pidfile under `$HOME/.config/maxq`; it does **not** write Chrome `ProxyMode`/`ProxyServer` policies. The persist CA lives at `$HOME/.config/maxq/ca` and survives revert; trust install is documented there, not auto-applied to `/usr` or Chrome.

Revert never deletes `$HOME`, SSH keys, Chrome logins, Chrome managed policies, the GOST binary, or the CA.

MaxQ is the point where your bot computer is fully loaded, configured, and operating at its limit.
