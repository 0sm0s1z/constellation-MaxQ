# Invariants and trust

These rules define a conforming MaxQ installation.

## Ownership

- Persist only under `$HOME`: `$HOME/bin`, `$HOME/.config/maxq`, and `$HOME/.local`.
- Remove only files MaxQ owns.
- Never delete `$HOME`, SSH keys, Chrome profiles, or preexisting CLIs.
- Keep the persistent CA across revert.

## Browser and proxy

- Never write Chrome `ProxyMode`, `ProxyServer`, or managed proxy policy.
- Keep GOST and MITM interception off by default.
- Do not modify `/usr/local/bin/box-chrome`; it is sand-owned.
- Browser launchers must not invent a proxy path.

## Network boundary

The control API listens on `127.0.0.1:7432` by default and rejects non-loopback binds. It has no authentication beyond that local boundary.

## CA trust

MaxQ creates its CA under `$HOME/.config/maxq/ca` but does not install it into system or Chrome trust. Trust installation and interception are separate, explicit operator actions.

```bash
maxq proxy intercept on
maxq proxy on
```

Do not enable interception until the intended client trusts the CA. See the repository `docs/TRUST.md` for manual trust steps.
