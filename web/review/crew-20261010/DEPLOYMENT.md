# Crew production verification — 2026-10-10

- Page: https://maxq.cxn.sh/#crew
- Source commit: `987f37936f5045ad7e6dc754e9b8a55425bc9d2c` on `main`, pushed before deployment.
- Vercel project: `maxq` / `prj_AfUTP6OHL2unAEnwkBtMNpjzMbDD`.
- Deployment: `dpl_piZdSGYmuwsmQr2nhNQYToU1BSQE`, production, Ready.
- Deployment URL: https://maxq-rb2ji18kw-0sm0s1zs-projects.vercel.app
- Method: temporary file deployment of a clean Git archive containing committed source and every public asset. Existing project linkage was verified before deployment. Shared configuration was unchanged.
- Build: `npm run build` (`tsc --noEmit && vite build`) passed against current remote main plus the bounded Crew changes.

## Browser evidence

`live/verification.json` records production interaction checks at desktop 1440×1000 and mobile 390×844. Crew availability scrolling, full-capture opening, stack navigation/back, the home Crew surface and product menu passed. Shared navigation was checked on every route. Cue/Router/Stack images, Docs slug navigation and Shareables article open/close passed. No page errors, failed site requests or Crew horizontal overflow were observed.

`live/crew-desktop.png` and `live/crew-mobile.png` are full-page screenshots of the published website. `live/assets.json` records successful HTTP checks for all 85 committed public assets.

## Limits

Fresh native Crew screenshots remain blocked: CoreGraphics screen-capture preflight returned false on 2026-10-10, including the post-deployment check. The existing product image is unchanged and explicitly captioned as an earlier development capture. These website screenshots establish page presentation and behavior only.

The existing dependency audit reports one moderate and two high development-dependency vulnerabilities. `npm audit --omit=dev` reports zero vulnerabilities. Dependency changes were outside this copy update.
