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
- Keep all three hero slides flat on the page canvas.
- Use .bezel only for product screenshots.
- Keep and animate public/art/rocket.webp as a flipbook.
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
- Flattened hero CSS already shipped live: .slide{margin:0} with no box. Branch web/hero-carousel-flatten.
