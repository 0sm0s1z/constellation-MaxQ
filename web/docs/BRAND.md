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

## Hero: the launch canvas

The first screen is one full-bleed moving canvas (`.launch`), not a copy column plus a
carousel. The Cue export is the clock: ignition at 0.5s, apogee at 3.5s, hold. Everything
else is staggered against it in `styles.css` (`.r1`–`.r7`, `.is-live`, `.is-apogee`,
`.is-held`).

- Rocket right, copy left; the rocket plays once and holds at the top (no `loop`).
- The left column is four blocks, top to bottom: title (eyebrow, line, wordmark); claim
  ("A co-operating system for your bot and you." + one-line lede + CTAs); split (`The bot
  gets` / `You get`); glass (one product shot at a time, three mono captions). Title and
  claim ride the flight; split and glass land after apogee (`.late`).
- The glass cycles every 5.2s once the rocket holds. The shot on screen names the telemetry
  key that glows (`GLASS[].tele` → `.telemetry li[data-key].is-hot`). Hover or focus pauses it.
- Premise for all hero copy: MaxQ is a co-operating system for the bot and the operator.
  One command on the bot's computer turns the stock box into a machine built for the bot;
  the operator keeps the side door. Write from that, not from the feature list.
- Wordmark is `public/namelogo.svg` used as a CSS mask so `.pastel-flow` paints the letters.
- Four-point sparks (`.spark`) are placed by hand in `pages.ts` (`SPARKS`) and twinkle/rotate
  like the Cue star tracks.
- Telemetry (`state`, `intercept`, `persist`, `prove`) lights at apogee. It replaced the proof strip.
- Scene two: `.how::before` bleeds `public/art/hero-orbit.webp` behind the steps.
- No border, radius card, box shadow, or window chrome on the art. `.bezel` is for product
  screenshots only.

## Art and motion

- Hero launch uses Cue-exported `public/art/maxq-launch.webm` (1024×1180, 24fps, alpha VP9;
  GIF fallback if the video errors, still for reduced motion).
- Re-export from `~/Desktop/MaxQ/MaxQ-Baseline.cue` with
  `capturectl export --format webm --scale 1 --fps 24`.
- Replace `public/art/desk.webp`; it was taken from the Catppuccin website.
- Keep `public/art/ops.webp` for now.
- New generated art belongs under `public/art/` and must be committed.

## Voice

Short. Direct. Operator-register. Explain what the system does and what the operator does next. No startup poetry.
