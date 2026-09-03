# Brand

## Mark

Use the orbital Q in `brand/`: black field, white Q and orbit, peach satellite.

## Palette

Values come from `src/styles.css`.

| Token | Hex |
| --- | --- |
| crust | `#11111b` |
| mantle | `#181825` |
| base | `#1e1e2e` |
| text | `#cdd6f4` |
| sub | `#a6adc8` |
| peach | `#fab387` |
| mauve | `#cba6f7` |
| sky | `#89dceb` |
| green | `#a6e3a1` |
| lavender | `#b4befe` |
| pink | `#f5c2e7` |

Fonts: IBM Plex Sans and IBM Plex Mono.

## Hero

The carousel has three slides. Every slide sits flat on the canvas.

- No border.
- No radius card.
- No box shadow.
- No window chrome.
- No `.bezel` around hero art.
- `.bezel` is for product screenshots only.

Flattened CSS already shipped live: `.slide { margin: 0; }` with no box.

## Art and motion

- Keep `public/art/rocket.webp`; animate it as a flipbook.
- Replace `public/art/desk.webp`; it was taken from the Catppuccin website.
- Keep `public/art/ops.webp` for now.
- New generated art belongs under `public/art/` and must be committed.

## Voice

Short. Direct. Operator-register. Explain what the system does and what the operator does next. No startup poetry.

Hero art field must match page crust `#11111b` or be fully transparent. A baked navy plate (even without CSS chrome) reads as a ghost rectangle.
