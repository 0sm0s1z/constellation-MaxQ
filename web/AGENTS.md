# Agents — MaxQ site

Scope: `web/` only. This is a Vite + TypeScript site.

## Read first

- `docs/SOURCE-OF-TRUTH.md` — repository, Vercel, and shipping state
- `docs/BRAND.md` — visual and voice contract
- `docs/GROKBOT.md` — agent seating and build loop

## Layout

- `src/` — TypeScript and CSS
- `public/art/` — hero art
- `public/shots/` — product screenshots
- `public/logos/` — logos
- `brand/` — orbital Q source assets

Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`.

## Do

- Start site branches from `web/maxq-site`; use `web/*` branches.
- Commit source and all required `public/` assets before shipping.
- Run the package build script before reporting a ship.
- The home hero is the full-bleed launch canvas (`.launch` in `pages.ts`/`styles.css`). Keep the art flat on the canvas.
- Use .bezel only for product screenshots on secondary routes. The home page frames captures in `.cine` (landscape stills), `.desk` (the bot's desk: 16:9 screen + menubar + Plank dock), and `.screen` (surfaces). Pastel art goes in `.plate`. See `docs/BRAND.md` "Home, below the fold".
- Home stills: EVA is a Cue cinema crop (`*-cine.webp`). The bot's desk below the fold is `bots-desk-stage.webp` inside Apple-dark window chrome (`bots-desk-dock.webp` overlay). Hero glass uses `bots-desk-wall.webp` + dock, no window frame. Do not cover-crop the dock off the desk.
- The home page is the product explanation, not just the hero. `#how` steps, `#kit` tiles (`KIT`), `#trust` (`OWNS` / `REFUSES` / `PROOF`) must match `README.md` and `docs/*.md`. Change the docs first, then the page. Do not invent tools or claims.
- Work the site on `main` now that the launch-canvas branch is merged. Push before deploying; Vercel Git deploys `main` to production. Re-point `maxq-pied.vercel.app` if the alias did not follow.
- Hero launch graphic is Cue-exported `public/art/maxq-launch.webm` on Chromium/Firefox (played once and held). Safari/iOS use `public/art/maxq-launch.safari.mov` (premultiplied HEVC with alpha). GIF fallback if video fails, still for reduced motion. Wordmark is `public/namelogo.svg` as a CSS mask. See `docs/BRAND.md`.
- Keep public/art/ops.webp for now.
- Record the commit and deployment proof.

## Do not

- Do not treat /workspace/maxq-web as source of truth.
- Do not deploy to leftover Vercel project maxq-site.
- Do not merge unless Matthew says.
- Do not add a hero border, radius card, box shadow, or window chrome.
- Do not use .bezel around hero art.
- Do not reuse public/art/desk.webp; replace it; it came from the Catppuccin website.

## Current debt

- Production project maxq has link: null and still needs a git link to this repository.
- Target Root Directory is web; target production branch is web/maxq-site.
- File deployment is only a stopgap and must include all of public/ or images 404.
- Leftover project maxq-site is git-linked, latest deploy ERROR, not live.
