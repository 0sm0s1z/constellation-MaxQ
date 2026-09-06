/**
 * Kit icon pack. One Mocha-tinted mark per tile in `#kit`.
 *
 * Treatment: real identity path, `fill`/`stroke="currentColor"`. Tile colour
 * comes from `data-tint` on each `.kit-tile`. Do not fall back to monograms.
 *
 * Provenance
 * - catppuccin: official cat silhouette from catppuccin/catppuccin `logo_dev.svg`
 * - chrome, claude, vercel, tailscale: Simple Icons (CC0)
 * - ghostty: Ghostty mark (same path as Simple Icons community)
 * - rofi: davatorium stacked-window mark, stroked (no public SVG)
 * - herdr: official ram, `assets/logo.svg`, plate stripped
 * - grok: grok.com favicon swirl (Feb 2025 identity)
 * - codex: OpenAI blossom (Simple Icons `openai`)
 * - opencode: sst/opencode favicon window, plate stripped
 * - maxq: product icon (geometric Q + orbit + peach satellite; same as `public/loader.svg`)
 * - desktops, resources: MaxQ surfaces — pack originals
 * - gost: no public mark; nested CONNECT chevrons
 */
import catppuccin from "./catppuccin.svg?raw";
import chrome from "./chrome.svg?raw";
import ghostty from "./ghostty.svg?raw";
import rofi from "./rofi.svg?raw";
import herdr from "./herdr.svg?raw";
import grok from "./grok.svg?raw";
import codex from "./codex.svg?raw";
import claude from "./claude.svg?raw";
import opencode from "./opencode.svg?raw";
import vercel from "./vercel.svg?raw";
import tailscale from "./tailscale.svg?raw";
import maxq from "./maxq.svg?raw";
import desktops from "./desktops.svg?raw";
import resources from "./resources.svg?raw";
import gost from "./gost.svg?raw";

export const kitIcons = {
  catppuccin,
  chrome,
  ghostty,
  rofi,
  herdr,
  grok,
  codex,
  claude,
  opencode,
  vercel,
  tailscale,
  maxq,
  desktops,
  resources,
  gost,
} as const;

export type KitIcon = keyof typeof kitIcons;
