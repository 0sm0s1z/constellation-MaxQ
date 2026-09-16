# MaxQ entitlements / bot reach visibility

MaxQ exposes a HOME-only merged allow/deny view of what the box currently knows about bot reach. The surface is deliberately source-labeled: every row says where it came from, and only operator-owned rows are editable through the entitlements API and settings sheet.

This is a visibility and local policy artifact. It is **not** a Tailscale SaaS/admin ACL editor, does not decode Home Assistant token scopes, and does not implement the firewall UI tracked separately by #89.

## Operator source of truth

Operator-managed rows are stored at:

```text
$HOME/.config/maxq/entitlements.json
```

The file is written atomically with mode `0600`. A missing file is valid and means the operator-defined set is empty. Derived/imported rows still appear in the merged GET response.

Example:

```json
{
  "entries": [
    {
      "action": "allow",
      "kind": "host",
      "value": "ha.home.arpa",
      "label": "Home Assistant host",
      "source": "operator"
    },
    {
      "action": "deny",
      "kind": "cidr",
      "value": "10.0.99.0/24",
      "label": "lab quarantine",
      "source": "operator"
    }
  ]
}
```

Operator rows accept `action` `allow` or `deny`, a supported `kind` (`host`, `cidr`, `service`, `ha-entity`, `network`, or `tag`), a non-empty `value`, and an optional `label`. The persisted source is always `operator`; PUT cannot create or overwrite system-derived source rows. Duplicate operator rows with the same action/kind/value are collapsed.

## Merged source labels

`GET /entitlements` returns the operator rows plus current rows derived from existing MaxQ sources:

- `operator` — entries persisted in `entitlements.json`.
- `ha-allowlist` — one read-only `allow / ha-entity` row for each entity currently returned by the existing Home Assistant allowlist source. These entries are linked to `$HOME/.config/maxq/ha-allowlist.json`; they are never copied into `entitlements.json`.
- `network` — one read-only network visibility row derived from MaxQ's local network mode/status. A local `up` marker is represented as allow; `down` or no successful MaxQ join marker is represented as deny with an explanatory label. This row does not claim to reflect cloud Tailscale ACLs.
- `maxq` — a built-in read-only allow row for the loopback MaxQ control API listener.

Every response entry includes `source`. The top-level response includes the operator-file path and the semantics marker:

```json
{
  "source": "/home/box/.config/maxq/entitlements.json",
  "semantics": "merged-allow-deny-with-source-labels",
  "entries": [
    {"action":"allow","kind":"host","value":"ha.home.arpa","source":"operator"},
    {"action":"allow","kind":"ha-entity","value":"light.kitchen","source":"ha-allowlist"},
    {"action":"deny","kind":"network","value":"tailscale","label":"MaxQ network marker: disconnected","source":"network"},
    {"action":"allow","kind":"service","value":"127.0.0.1:7432","label":"MaxQ loopback control API","source":"maxq"}
  ]
}
```

## API

The control API remains loopback-only.

### Read merged scope

```http
GET /entitlements
```

The response is rebuilt from current sources on each read. Updating the HA allowlist or MaxQ network state therefore changes imported rows without rewriting the operator artifact.

### Replace operator scope

```http
PUT /entitlements
Content-Type: application/json

{
  "entries": [
    {"action":"allow","kind":"host","value":"ha.home.arpa","label":"Home Assistant host","source":"operator"}
  ]
}
```

PUT replaces only the operator-owned set. Imported `ha-allowlist`, `network`, and `maxq` rows cannot be supplied as writable rows. Secret-looking fields such as `auth_key`, token, password, credential, or authorization fields are rejected rather than persisted.

The response never includes the stored network auth/preauth key. Network authentication remains boolean-only on the existing `/policy` surface as `auth_key_configured` and is intentionally absent from `/entitlements`.

## Settings sheet

The HOME settings sheet includes an **Entitlements / bot reach** matrix with action, kind, value/label, and source columns.

Operator rows can be added, removed, and saved. Imported rows are read-only and carry source badges. Home Assistant entities must be edited in the existing **Home Assistant allowlist** card; the entitlements card only links/imports that scope and does not duplicate the #86 editor.

## P04 prove boundary

P04 can PASS when the loopback settings sheet/API visibly shows the merged allow/deny matrix with source labels and the durable operator artifact is editable independently of imported rows.

The network row is deliberately limited to MaxQ's locally known mode and `network.status` marker. It is not a claim about Tailscale cloud ACL evaluation. Home Assistant rows likewise reflect only the existing curated entity allowlist, not HA token scopes or live device permissions.

## Non-goals

- No Tailscale SaaS/admin ACL editor.
- No Home Assistant token-scope decoding or fake device control.
- No firewall UI (#89).
- No reimplementation of network leave/disconnect (#90).
- No duplicate HA allowlist editor (#86).
- No secrets in API responses, logs, docs examples, or persisted entitlement fields.
