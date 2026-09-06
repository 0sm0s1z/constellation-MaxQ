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
- The left column is four blocks: title; claim + CTAs; split (`The bot gets` /
  `You get` as two columns); glass (one landscape shot, captions under it).
  Title and claim ride the flight; split and glass land after apogee (`.late`).
- The glass well is a locked 2.75:1 frame. Stills of different pixel sizes are
  `object-fit: cover` inside it — the frame must not resize between slides.
  Captions stay on one line (`01 the bot's desk` / `02 the side door` /
  `03 more tokens`). Clicking the well follows `GLASS[].href` (`#desk`, `#door`,
  `#frontier`). Chip + split copy ripple (~220ms). No typewriter.
- Split copy is per-slide. Labels stay `The bot gets` / `You get`. Charge the
  speech from `docs/VISION.md`.
- Eyebrow: `Constellation · one box. two operators.` Do not say "first product."
- Premise for all hero copy: MaxQ is a co-operating system for the bot and the operator.
  One command on the bot's computer turns the stock box into a machine tailored for the bot;
  the operator keeps the side door. Write from that, not from the feature list.
- Wordmark is `public/namelogo.svg` used as a CSS mask so `.pastel-flow` paints the letters.
- Four-point sparks (`.spark`) are placed by hand in `pages.ts` (`SPARKS`) and twinkle/rotate
  like the Cue star tracks.
- Telemetry (`state`, `intercept`, `persist`, `prove`) lights at apogee. It replaced the proof strip.
- Scene two: `.how::before` bleeds `public/art/hero-orbit.webp` behind the steps.
- No border, radius card, box shadow, or window chrome on the art. `.bezel` is for product
  screenshots on the secondary routes only; the home page does not use it.

## Header

`.topbar` is sticky. Its glass is a viewport-wide `::before` (blur + crust tint) feathered to
transparent at the bottom, so it never reads as a card with side edges or a hard bottom line.
`html`/`body` carry `overflow-x: clip` for that and the other full-bleed backdrops; `#app` must
not set `z-index` (it would isolate the blended art plates from the starfield).

## Home, below the fold

Same treatment as the launch canvas: art flat on the page, real captures in one locked frame,
copy in operator register.

- **Art plates** (`.plate`): `public/art/hero-laptop.webp` in `#how`, `public/art/ops.webp` in
  `#door`. The art's dark field is blended out (`mix-blend-mode: lighten`) and radially feathered;
  a soft pastel pool sits under it. No frame, no chrome.
- **Cinema stills** (`.cine`): one full-width 2.2:1 frame per beat, cover-fit, hairline, 8px
  radius, mono caption (`maxq · the bot's desk` / `box@grokbot`). The stills are cropped in Cue
  from the real captures — window chrome and VNC borders removed — and saved as
  `public/shots/*-cine.webp` (`bots-desk-cine.webp` 1079×490, `desktops-eva-cine.webp` 1600×727).
  The hero glass uses the same crops. Do not put a raw screenshot with its own title bar in a frame.
- **Beats**: eyebrow + display headline in one column, lede + `The bot gets` / `You get` in the
  other, still beneath. `#door` puts the ops plate where the headline column would be.
- **Surfaces** (`.screen`): locked 2:1 frame, cover-fit, no traffic lights; panels crossfade.
  The MaxQ surface uses its own native 2:1 cut (`desktops-eva-wide.webp` 1600×800, y −100) so
  the header text is never cover-cropped.

## Phone (≤720px)

One column. The hero reads title → rocket → claim and CTAs → split → glass; `.launch-copy` is
`display: contents` so its blocks and the stage share one grid and take `order`. Sparks and the
floating diamonds are off on phones (they land on text). Tabs fill the pill without their numbers.

Re-cut a still through `capturectl` (create → import → `scene.setCanvas` + `layer.transform` →
render), not by hand-cropping in a paint tool; keep offsets in the commit message.

## Art and motion

- Hero launch uses Cue-exported `public/art/maxq-launch.webm` (1024×1180, 24fps, VP9
  with alpha) on Chromium/Firefox. Safari and iOS drop VP9 alpha (opaque black +
  bloom), so they get `public/art/maxq-launch.safari.mov` (premultiplied HEVC `hvc1`
  `PresetHEVCHighestQualityWithAlpha`). GIF fallback if the video errors; still
  for reduced motion. Do not put the WebM `<source>` in the Safari video element
  or WebKit will pick it and paint a black rectangle.
- Re-export WebM from `~/Desktop/MaxQ/MaxQ-Baseline.cue` with
  `capturectl export --format webm --scale 1 --fps 24`, then:
  `ffmpeg -c:v libvpx-vp9 -i maxq-launch.webm -pix_fmt rgba frames/%04d.png`
  then premultiply RGB by alpha (Safari HEVC alpha is associated), encode ProRes
  4444, then `avconvert -s premul.mov -o safari.mov -p PresetHEVCHighestQualityWithAlpha --replace`.
  Do not transcode the WebM with `yuva420p` — that is straight alpha on 4:2:0 and
  shows up as a peach fringe around the platform glow.
- Replace `public/art/desk.webp`; it was taken from the Catppuccin website.
- Keep `public/art/ops.webp` for now.
- New generated art belongs under `public/art/` and must be committed.

## Voice

Short. Direct. Operator-register. Explain what the system does and what the operator does next. No startup poetry.
