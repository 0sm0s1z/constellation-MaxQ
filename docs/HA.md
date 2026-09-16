# Home Assistant curated entity allowlist

MaxQ exposes a HOME-only Home Assistant entity allowlist for the small set of entities an operator wants a bot to see. It is deliberately **not** a Home Assistant inventory mirror and it does not fetch, discover, or control devices by itself.

## Source of truth

The allowlist is stored at:

```text
$HOME/.config/maxq/ha-allowlist.json
```

The file is written atomically with mode `0600`. A missing file is valid and means the curated set is empty: no Home Assistant entities are bot-visible through this MaxQ surface.

Example:

```json
{
  "entities": [
    {"id": "light.kitchen", "label": "Kitchen light"},
    {"id": "lock.front_door", "label": "Front door"}
  ]
}
```

Entity IDs are trimmed, validated as simple lower-case Home Assistant entity IDs (`domain.object_id`), and deduplicated by ID. Labels are optional.

## API

The control API remains loopback-only.

### Read

```http
GET /ha/allowlist
```

Example response:

```json
{
  "entities": [
    {"id": "light.kitchen", "label": "Kitchen light"}
  ],
  "source": "/home/box/.config/maxq/ha-allowlist.json",
  "semantics": "curated-allowlist-not-full-dump",
  "bot_visible_only": true
}
```

`semantics` and `bot_visible_only` are explicit guardrails: this response is the curated bot-visible set, not a full HA entity dump.

### Replace

```http
PUT /ha/allowlist
Content-Type: application/json

{
  "entities": [
    {"id": "light.kitchen", "label": "Kitchen light"}
  ]
}
```

PUT replaces the complete curated set. An empty array is valid and intentionally makes no entities bot-visible.

## Settings sheet

The HOME settings sheet includes a **Home Assistant allowlist** card. Operators can add an entity ID with an optional label, remove entries from the local working set, and save the entire allowlist with PUT.

The sheet does not present device toggles, HA state, discovery results, or other fake control surfaces. It only manages the visible allowlist source.

## P03 prove boundary

P03 can PASS when the curated source is visible and editable through the loopback API/settings sheet and responses explicitly retain `curated-allowlist-not-full-dump` semantics.

Live Home Assistant reach or actuation is outside this change. If the box still needs P01 network join to reach the HA host, that dependency remains; this allowlist does not attempt to bypass or replace it.
