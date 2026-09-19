# Operator glass

Operator glass is the secondary control surface for the person responsible for the box. It does not replace the agent's desktop.

## Settings

Open `http://127.0.0.1:7432/` on the box. The sheet reports applied state, theme, GOST state, and installed CLIs. Apply and revert actions call the loopback [Control API](#docs/control-api).

## Desktops

The desktop multiplexer exposes live Xvfb displays, normally `:1` through `:15`, through noVNC. Use it to inspect a desktop, switch displays, or open the current desktop.

Do not kill:

- Xvfb or the Chrome profile on `DISPLAY=:23`.
- Token-backed websockify on port `6081`.
- Sand-owned browser launchers.

## Actions

Use the settings actions for explicit state changes:

- Apply the current MaxQ configuration.
- Revert MaxQ-owned configuration.
- Enable or disable the local GOST process.
- Inspect package and CLI inventory.

Changes remain bounded by the [invariants](#docs/invariants). The API refuses non-loopback binds.
