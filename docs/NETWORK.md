# MaxQ network control plane

MaxQ keeps Tailscale as the default network mode and supports an operator-supplied Headscale control plane from the loopback settings sheet. This is HOME-only configuration; it does not change the public web/sell site and it does not add network actions to `maxq apply` or `maxq prove`.

## Modes

### Tailscale (default)

With no network configuration file, MaxQ reports `tailscale` mode. Fresh `maxq apply` behavior is unchanged: MaxQ installs/manages the `tailscale` and `tailscaled` binaries but does not automatically call `tailscale up`.

Selecting Tailscale in the settings sheet and choosing **Save & join** runs plain `tailscale up` for a fresh/default configuration. When explicitly switching from Headscale back to Tailscale, MaxQ supplies Tailscale's hosted login server so the client does not remain bound to the previous custom control plane.

### Headscale

Headscale mode requires an operator-supplied HTTP(S) `login_server`. MaxQ does not hard-code a Headscale deployment. Example values in tests and documentation use placeholders such as:

```text
https://headscale.example.invalid
```

Choosing **Save & join** persists the setting and runs:

```text
tailscale up --login-server=https://headscale.example.invalid
```

If `login_server` is empty or invalid, the request fails before `tailscale up` runs. MaxQ never silently retries against Tailscale SaaS after a Headscale validation or join failure.

## Persistence and secret handling

Network state is stored under the MaxQ HOME prefix:

```text
$HOME/.config/maxq/network.toml
$HOME/.config/maxq/network.authkey   # only when an auth/preauth key is supplied
```

Both files are written with mode `0600`. `network.toml` contains only mode and login-server configuration. An optional auth/preauth key is stored separately in `network.authkey` and is passed to the client as `--auth-key=file:<path>`, so the key itself is not present in the process arguments. The control API returns only `auth_key_configured: true|false`; it never returns the key value. Error output is also redacted against the stored key.

`maxq prove` does not invoke the network join path, so auth material is not emitted into prove logs.

## Control API

Network settings are exposed through the existing loopback-only settings endpoint so no new listener or routing surface is introduced.

`GET /policy` includes:

```json
{
  "network": {
    "mode": "tailscale",
    "login_server": "",
    "auth_key_configured": false
  }
}
```

To select Headscale and join it:

```json
POST /policy
{
  "network": {
    "mode": "headscale",
    "login_server": "https://headscale.example.invalid",
    "auth_key": "<optional-preauth-key>"
  }
}
```

A blank auth-key field in the settings sheet leaves an already stored key unchanged. API callers can remove a stored key with `"clear_auth_key": true`. Do not supply `auth_key` and `clear_auth_key` together.
