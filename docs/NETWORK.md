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

The settings sheet exposes the optional **Auth / preauth key** field in both Tailscale and Headscale modes. **Login server** remains Headscale-only. Leaving the key field blank keeps any stored key unchanged.

## Leave / disconnect

The settings sheet exposes **Leave / Disconnect** beside **Save & join**. It sends a network action through the existing loopback `/policy` API and runs:

```text
tailscale down
```

MaxQ intentionally uses `tailscale down` rather than `tailscale logout`. `down` removes active tailnet/home-fabric reach while preserving the node identity and the selected Tailscale or Headscale control-plane binding. That makes the operation reversible: the operator can restore the same enrollment with **Save & join**. The leave path is identical in Tailscale and Headscale modes and never supplies a login server, so a Headscale leave cannot fall back to Tailscale SaaS.

After a successful join or leave, MaxQ records only the non-secret runtime marker `up` or `down` in `$HOME/.config/maxq/network.status`; `GET /policy` and the sheet surface that state. Failed operations do not overwrite the last successful marker.

The network leave path does **not** stop GOST. The proxy path is a separate documented control. To cut both fabric access and the proxy path, use **Leave / Disconnect** and then either:

```text
maxq proxy off
```

or the sheet's **Proxy Off** button. Restoring both paths is **Save & join** followed by `maxq proxy on` / **Proxy On** when the proxy is required.

## Persistence and secret handling

Network state is stored under the MaxQ HOME prefix:

```text
$HOME/.config/maxq/network.toml
$HOME/.config/maxq/network.authkey   # only when an auth/preauth key is supplied
$HOME/.config/maxq/network.status    # up/down marker after successful MaxQ network actions
```

These files are written with mode `0600`. `network.toml` contains only mode and login-server configuration. An optional auth/preauth key (Tailscale or Headscale) is stored separately in `network.authkey` and is passed to the client as `--auth-key=file:<path>`, so the key itself is not present in the process arguments. The control API returns only `auth_key_configured: true|false`; it never returns the key value. Error output is also redacted against the stored key.

`maxq prove` does not invoke the network join or leave path, so auth material is not emitted into prove logs.

## Control API

Network settings are exposed through the existing loopback-only settings endpoint so no new listener or routing surface is introduced.

`GET /policy` includes:

```json
{
  "network": {
    "mode": "tailscale",
    "login_server": "",
    "auth_key_configured": false,
    "status": "down"
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

To disconnect the fabric without discarding enrollment:

```json
POST /policy
{
  "network": {
    "action": "leave"
  }
}
```

A network action cannot be combined with mode, login-server, or auth-key settings in the same request. A blank auth-key field in the settings sheet leaves an already stored key unchanged. API callers can remove a stored key with `"clear_auth_key": true`. Do not supply `auth_key` and `clear_auth_key` together.

The entitlements visibility surface imports a read-only `source: "network"` row from this local mode/status state. `status=up` is shown as locally joined; `down` or no successful MaxQ join marker is shown as not currently joined by MaxQ. That row does not evaluate or claim knowledge of Tailscale cloud ACLs and never exposes auth-key material. See [ENTITLEMENTS.md](ENTITLEMENTS.md).

## Prove P06 re-check

For the P06 ACCESS re-check, establish home-fabric reach first, then use **Leave / Disconnect**. The Tailscale client should go down and the bot should lose tailnet/home-fabric reach. If the proxy path also needs to be removed, run `maxq proxy off` or press **Proxy Off**. Restore fabric reach with **Save & join**, then restore the proxy separately with `maxq proxy on` / **Proxy On** if required.
