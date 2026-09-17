# Overview

MaxQ configures the Linux computer an agent operates. It installs operator controls, desktop access, themes, launchers, and selected CLIs without taking ownership of the machine.

## Operating model

- `apply` writes MaxQ-owned state under `$HOME`.
- `prove` exercises revert and apply, asserts the result, and leaves MaxQ applied.
- `revert` removes MaxQ-owned configuration. It does not wipe the account.
- The control API and settings sheet listen on loopback.

MaxQ has two users: the agent works on the box; the operator inspects and controls it through settings, desktops, actions, and status.

## Start here

1. Read [Install](#docs/install) and run the installer.
2. Open [Operator glass](#docs/operator-glass) to inspect the applied state.
3. Read [Invariants](#docs/invariants) before enabling proxy interception or extending MaxQ.
4. Use the [Control API](#docs/control-api) for loopback automation.

## Scope

MaxQ is a persist-safe workstation layer. It is not a package manager, remote admin suite, browser automation framework, or system-wide policy manager.
