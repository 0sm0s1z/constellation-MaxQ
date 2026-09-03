# Source of truth

## Honest state

| Item | Truth |
| --- | --- |
| Canonical repo | `0sm0s1z/constellation-MaxQ`; SSH key `~/.ssh/github-0sm0s1z` |
| Site | Vite + TS in `web/`; scripts `dev`, `build`, `preview`; build is `tsc --noEmit && vite build` |
| Production | https://maxq-pied.vercel.app — Vercel **maxq**, `prj_AfUTP6OHL2unAEnwkBtMNpjzMbDD` |
| Team | `team_t8wJzdEfWlgI5RChftfK72Xr` / `0sm0s1zs-projects` |
| Production link | `link: null`; file deploys are a stopgap |
| Leftover project | **maxq-site**, `prj_163P0pSQLGFSA94GeHqMnzusyFNa`; git-linked; latest deploy ERROR; not live; never deploy here |
| Old tree | `/workspace/maxq-web` is a non-git editing folder; not canonical |
| Production line | `web/maxq-site`; site PRs use `web/*`; do not merge unless Matthew says |
| Live flattening | `.slide { margin: 0; }`, no box; shipped live; branch `web/hero-carousel-flatten` |

## Target state

Git-link **maxq** to this repo with Root Directory `web` and production branch `web/maxq-site`. Do not use **maxq-site**.

Until linked, file deploys must include all of `public/` (art/shots/logos) or images 404.

## Prove a ship

1. Identify the site branch and commit SHA.
2. Run the web build; keep dist out of git.
3. Confirm deployment belongs to project maxq, not maxq-site.
4. Record the deployment URL and check https://maxq-pied.vercel.app.
5. Check art, shots, and logos for 404s.
6. State whether the ship was git-linked or a temporary file deploy.

A live page without a matching committed SHA is not conformed.
