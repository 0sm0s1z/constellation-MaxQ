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
- Keep all three hero slides flat on the page canvas.
- Use .bezel only for product screenshots.
- Keep and animate public/art/rocket.webp as a flipbook.
