# Install, apply, prove, revert

Install from the canonical repository:

```bash
curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash
```

The installer places `maxq` in `$HOME/bin` and runs `maxq apply`.

## Lifecycle

| Command | Result |
| --- | --- |
| `maxq status` | Prints `applied` or `reverted`. |
| `maxq apply` | Reconciles MaxQ-owned configuration. Safe to run again. |
| `maxq prove` | Runs revert, apply, and assertions. Leaves the machine applied. |
| `maxq revert` | Removes MaxQ-owned configuration and stops MaxQ processes. |

## Verify

```bash
maxq status
maxq prove
```

A passing proof reports `result=PASS`, `state=applied`, and `intercept=false`.

## Revert boundaries

Revert does not delete `$HOME`, SSH keys, browser profiles, the persistent CA, or preexisting CLIs. Cached CLI downloads and retained binaries may remain so a later apply does not need to fetch them again.

Read [Invariants](#docs/invariants) for the ownership contract.
