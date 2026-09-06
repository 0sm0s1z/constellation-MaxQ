import markChrome from "./logos/googlechrome.svg?raw";
import markGhostty from "./logos/ghostty.svg?raw";
import markClaude from "./logos/claude.svg?raw";
import markOpencode from "./logos/opencode.svg?raw";
import markVercel from "./logos/vercel.svg?raw";
import markTailscale from "./logos/tailscale.svg?raw";

export type Route = "home" | "stack" | "router" | "cue" | "crew" | "install" | "invariants" | "ops" | "frontier";
export const INSTALL =
  "curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash";
export const GITHUB = "https://github.com/0sm0s1z/constellation-MaxQ";

const HOME_HASHES = new Set(["", "home", "desk", "door", "how", "kit", "trust", "surfaces", "start"]);

export function parseRoute(): Route {
  const hash = (location.hash || "#home").replace("#", "");
  if (HOME_HASHES.has(hash)) return "home";
  const known: Route[] = ["home", "stack", "router", "cue", "crew", "install", "invariants", "ops", "frontier"];
  return (known as string[]).includes(hash) ? (hash as Route) : "home";
}

const installLine = () => `
  <div class="term"><code><span class="ps1">$</span><span class="cmd">${INSTALL}</span><span class="cursor"></span></code><button class="copy" type="button" data-copy="${INSTALL}">copy</button></div>`;

const shot = (src: string, alt: string, caption: string, w: number, h: number) => `
  <figure class="shot"><img src="${src}" alt="${alt}" width="${w}" height="${h}" /><figcaption>${caption}</figcaption></figure>`;

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const bezel = (src: string, alt: string, caption: string, kind: "laptop" | "phone" = "laptop", w = 1280, h = 800) => `
  <figure class="bezel ${kind}">
    <div class="chrome"><span></span><span></span><span></span></div>
    <img src="${src}" alt="${alt}" width="${w}" height="${h}" />
    <figcaption>${caption}</figcaption>
  </figure>`;

/* Surfaces index. Shots sit in a locked `.screen` frame (cover-fit), never in window chrome. */
const surfaces = [
  {
    id: "router",
    num: "01",
    label: "Router",
    title: "Make every seat count.",
    lede: "Constellation Auto picks the model from seats you already pay for: how hard the job is, the cheapest token left, and how close that seat is to reset.",
    src: "/shots/router-dashboard.webp",
    alt: "Constellation Router dashboard: seats, included usage, reset clocks",
    cap: "router · seats",
    w: 1100,
    h: 535,
    pos: "50% 0%",
    href: "#router",
  },
  {
    id: "maxq",
    num: "02",
    label: "MaxQ",
    title: "The computer Grok Bot runs on.",
    lede: "Tools for the bot. Controls for you: settings, telemetry, processes, every desktop on one sheet.",
    src: "/shots/desktops-eva-wide.webp",
    alt: "MaxQ operator desktops: nine live sessions and the STREAM sidebar",
    cap: "maxq · desktops",
    w: 1600,
    h: 800,
    pos: "50% 0%",
    href: "#home",
  },
  {
    id: "cue",
    num: "03",
    label: "Cue",
    title: "Native glass. Not an Electron fork.",
    lede: "Swift and SwiftUI chat-and-steer for macOS. Capture, compose, hand off. iOS is landing.",
    src: "/shots/cue-macos.webp",
    alt: "Cue macOS: the MaxQ launch region on the canvas, inspector and filmstrip",
    cap: "cue · macOS",
    w: 1100,
    h: 682,
    pos: "50% 0%",
    href: "#cue",
  },
  {
    id: "crew",
    num: "04",
    label: "Crew",
    title: "Chat stays in Crew. The box is a provider.",
    lede: "Cue-style SwiftUI with pluggable computer providers: local Docker or VZ, Proxmox, EC2, a Mac you already own.",
    src: "/shots/crew-macos.webp",
    alt: "Crew macOS: Messages, MuxBot, Multiplexer",
    cap: "crew · macOS",
    w: 1006,
    h: 670,
    pos: "50% 0%",
    href: "#crew",
  },
];

/* Cinema still: one landscape frame, cropped in Cue from the real capture, mono caption under it. */
const cine = (src: string, alt: string, w: number, h: number, left: string, right: string) => `
  <figure class="cine">
    <div class="cine-frame"><img src="${src}" alt="${escapeAttr(alt)}" width="${w}" height="${h}" loading="lazy" /></div>
    <figcaption><span>${left}</span><span>${right}</span></figcaption>
  </figure>`;

/* Art plate: pastel isometric art flat on the canvas, feathered into the crust. No chrome. */
const plate = (src: string, alt: string, kind: string) => `
  <figure class="plate ${kind}"><img src="${src}" alt="${escapeAttr(alt)}" width="1280" height="853" loading="lazy" /></figure>`;

/* The kit. What `maxq apply` actually puts on the box, grouped the way the box is used.
   Marks are Simple Icons (CC0) inlined so they take the tile colour; tools without a public mark
   get a mono monogram. Facts follow README + docs/CLIS.md + docs/THEME.md + docs/API.md. */
type KitItem = { name: string; role: string; tag?: string; mark?: string; mono?: string; swatch?: true };
type KitGroup = { id: string; eyebrow: string; title: string; note: string; items: KitItem[] };
const KIT: KitGroup[] = [
  {
    id: "desk", eyebrow: "The desk", title: "The bot's tools",
    note: "Theme, launcher, terminal, browser. Set once, the same on every box.",
    items: [
      { name: "Catppuccin Mocha", role: "wallpaper · GTK · cursors", tag: "theme", swatch: true },
      { name: "Chrome", role: "official Mocha theme, per profile", tag: "$HOME only", mark: markChrome },
      { name: "Ghostty", role: "Mocha config block + theme", tag: "config-only", mark: markGhostty },
      { name: "rofi", role: "app launcher on Super + Space", tag: "launcher", mono: "⌘" },
    ],
  },
  {
    id: "bench", eyebrow: "The bench", title: "Operator CLIs in $HOME/bin",
    note: "Official linux amd64 builds, MaxQ-marked so revert knows what it owns.",
    items: [
      { name: "herdr", role: "session mux for coding agents", mono: "h" },
      { name: "Grok CLI", role: "grok", mono: "G" },
      { name: "Codex", role: "codex", mono: "C" },
      { name: "Claude Code", role: "claude", mark: markClaude },
      { name: "OpenCode", role: "opencode", mark: markOpencode },
      { name: "Vercel fx", role: "fx", mark: markVercel },
      { name: "Tailscale", role: "tailscale · tailscaled", mark: markTailscale },
    ],
  },
  {
    id: "door", eyebrow: "The side door", title: "Your controls, on loopback",
    note: "A thin local control surface. Not an admin suite.",
    items: [
      { name: "maxq-api", role: "127.0.0.1:7432 · status · apply · revert", tag: "loopback", mono: "◎" },
      { name: "Desktops", role: "every X display · VNC / noVNC", tag: "live", mono: "▦" },
      { name: "Resources", role: "RAM · CPU · agent profiles · kill", tag: "telemetry", mono: "∿" },
      { name: "GOST", role: "local CONNECT proxy · no MITM", tag: "off by default", mono: "⇄" },
    ],
  },
];

/* What `maxq prove` printed on the box (2026-09-02). Live type, not a raster. */
const PROOF: [string, string][] = [
  ["result", "PASS"],
  ["passed", "173"],
  ["failed", "0"],
  ["final_status", "applied"],
  ["final_theme", "mocha"],
  ["api_listen", "127.0.0.1:7432"],
  ["intercept", "false"],
  ["chrome_proxy_policy", "never"],
  ["clis_installed", "herdr fx grok codex claude"],
  ["left_state", "APPLIED"],
];

const OWNS = [
  ["$HOME/bin", "maxq, maxq-api, the MaxQ-marked CLIs"],
  ["$HOME/.config/maxq", "maxq.toml, pidfiles, CLI cache, the persist CA"],
  ["$HOME/.local/share", "Mocha wallpaper, GTK theme, cursors, Chrome theme files"],
  ["$HOME/.config/ghostty", "one marked MaxQ block; your config around it stays"],
];
const REFUSES = [
  ["/usr, /etc, PID 1", "nothing outside $HOME, no systemd units"],
  ["your keys and logins", "~/.ssh, Chrome cookies, Chrome managed policy"],
  ["the network", "binds 127.0.0.1 only; refuses 0.0.0.0 and ::"],
  ["your TLS", "intercept=false until you flip it; the CA is documented, not auto-trusted"],
];

const kitTile = (it: KitItem) => `
  <li class="kit-tile">
    <span class="kit-mark${it.swatch ? " is-swatch" : ""}">${
      it.swatch ? "<i></i><i></i><i></i><i></i>" : it.mark ?? `<b>${it.mono ?? it.name[0]}</b>`
    }</span>
    <span class="kit-text"><strong>${it.name}</strong><span>${it.role}</span></span>
    ${it.tag ? `<span class="kit-tag">${it.tag}</span>` : ""}
  </li>`;

const kitGroup = (g: KitGroup) => `
  <div class="kit-group" data-kit="${g.id}">
    <p class="eyebrow">${g.eyebrow}</p>
    <h3>${g.title}</h3>
    <p class="kit-note">${g.note}</p>
    <ul class="kit-list">${g.items.map(kitTile).join("")}</ul>
  </div>`;

/* Launch canvas. The Cue export is the clock: ignition 0.5s, apogee 3.5s, hold to 6s.
   Copy, sparks, and telemetry are staggered against that clock in styles.css (.r1–.r7).
   Sparks are the four-point stars from the Cue composition, placed by hand across the canvas. */
const SPARK_PATH = "M12 0C12.7 7.1 16.9 11.3 24 12C16.9 12.7 12.7 16.9 12 24C11.3 16.9 7.1 12.7 0 12C7.1 11.3 11.3 7.1 12 0Z";
type Spark = { x: string; y: string; size: number; tint: "mauve" | "peach" | "sky" | "lavender" | "pink"; dur: number; delay: number; spin: 1 | -1 };
const SPARKS: Spark[] = [
  { x: "6%",  y: "14%", size: 22, tint: "mauve",    dur: 5.2, delay: -1.1, spin: 1 },
  { x: "22%", y: "8%",  size: 12, tint: "sky",      dur: 4.1, delay: -2.6, spin: -1 },
  { x: "38%", y: "18%", size: 16, tint: "peach",    dur: 6.0, delay: -0.4, spin: 1 },
  { x: "49%", y: "6%",  size: 10, tint: "lavender", dur: 4.6, delay: -3.3, spin: -1 },
  { x: "9%",  y: "62%", size: 14, tint: "pink",     dur: 5.6, delay: -2.0, spin: 1 },
  { x: "31%", y: "76%", size: 20, tint: "sky",      dur: 4.9, delay: -1.7, spin: -1 },
  { x: "58%", y: "88%", size: 12, tint: "mauve",    dur: 5.9, delay: -0.9, spin: 1 },
  { x: "84%", y: "12%", size: 18, tint: "peach",    dur: 4.4, delay: -2.2, spin: -1 },
  { x: "94%", y: "40%", size: 12, tint: "lavender", dur: 6.3, delay: -3.8, spin: 1 },
  { x: "90%", y: "78%", size: 24, tint: "mauve",    dur: 5.0, delay: -1.4, spin: -1 },
  { x: "70%", y: "4%",  size: 10, tint: "pink",     dur: 4.2, delay: -0.2, spin: 1 },
];
const TELEMETRY: [string, string, boolean][] = [
  ["state", "applied", true],
  ["intercept", "false", false],
  ["persist", "$HOME only", false],
  ["prove", "PASS", true],
];
/* The glass: three shots, one at a time. `tele` names the telemetry key that glows while the shot is up. */
type GlassSlide = {
  src: string; w: number; h: number; alt: string;
  num: string; cap: string; tele: string; href: string;
  bot: string; you: string; chip: string; pos: string;
};
const GLASS: GlassSlide[] = [
  {
    src: "/shots/bots-desk-cine.webp", w: 1079, h: 490,
    alt: "The bot's MaxQ desk: mocha wallpaper, rofi launcher, Ghostty at box@grokbot",
    num: "01", cap: "the bot's desk", tele: "state", href: "#desk",
    bot: "A computer tailored for it. Terminal, browser, desktops, theme, and the skills to use them before the first task.",
    you: "An assistant that doesn't need onboarding. The desk is on your network. You can watch the herdr session.",
    chip: "box@grokbot", pos: "50% 40%",
  },
  {
    src: "/shots/desktops-eva-cine.webp", w: 1600, h: 727,
    alt: "MaxQ operator desktops: nine live Xvfb sessions and a STREAM sidebar",
    num: "02", cap: "the side door", tele: "intercept", href: "#door",
    bot: "Steering and a stable box. You can kill a runaway process before the RAM is gone.",
    you: "Telemetry, visibility, control. Nine desktops at once. Skills from the marketplace, on loopback.",
    chip: "14 / 22 live", pos: "50% 0%",
  },
  {
    src: "/research/frontier-400cap.webp", w: 1800, h: 900,
    alt: "Subscription Efficiency Frontier: SuperGrok Heavy in the best-value region",
    num: "03", cap: "more tokens", tele: "prove", href: "#frontier",
    bot: "More tokens. Usage limits on Bot are brutal. This gets it out of jail.",
    you: "More tokens. Constellation Router unlocks the subscription efficiency frontier.",
    chip: "Heavy · $0.065 / 1M FIE", pos: "22% 38%",
  },
];

/** Safari/iOS play VP9 WebM without alpha (opaque black). HEVC with alpha is the WebKit path.
 *  That HEVC file must be premultiplied 4:4:4 — Safari treats the RGB as associated. */
function prefersHevcAlpha(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  if (/Chrom(e|ium)|Edg|OPR|Firefox/i.test(ua)) return false;
  return /Safari/i.test(ua);
}

function renderLaunch(): string {
  const reduceMotion =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const alt = "MaxQ launch: a rocket lifting off a laptop";
  const still = `<img class="launch-still" src="/art/maxq-launch-still.webp" alt="${alt}" width="1024" height="1180" />`;
  const sources = prefersHevcAlpha()
    ? `<source src="/art/maxq-launch.safari.mov" type='video/mp4; codecs="hvc1"' />`
    : `<source src="/art/maxq-launch.webm" type="video/webm" />`;
  const stage = reduceMotion
    ? still
    : `
        <video class="launch-video" autoplay muted playsinline webkit-playsinline width="1024" height="1180" poster="/art/maxq-launch-still.webp" aria-label="${alt}">
          ${sources}
        </video>
        <img class="launch-gif" data-src="/art/maxq-launch.gif" alt="${alt}" width="614" height="708" hidden />
        ${still}`;
  const sparks = SPARKS.map(
    (s, i) =>
      `<svg class="spark ${s.tint}" viewBox="0 0 24 24" aria-hidden="true" style="left:${s.x};top:${s.y};width:${s.size}px;height:${s.size}px;--dur:${s.dur}s;--delay:${s.delay}s;--spin:${s.spin};--i:${i}"><path d="${SPARK_PATH}"/></svg>`
  ).join("");
  const telemetry = TELEMETRY.map(
    ([k, v, ok], i) =>
      `<li style="--i:${i}" data-key="${k}"><span class="tk">${k}</span><span class="tv${ok ? " ok" : ""}">${v}</span></li>`
  ).join("");
  const glassFrames = GLASS.map(
    (g, i) =>
      `<img class="${i === 0 ? "is-on" : ""}" src="${g.src}" alt="${g.alt}" width="${g.w}" height="${g.h}" loading="${i === 0 ? "eager" : "lazy"}" data-tele="${g.tele}" data-href="${g.href}" data-bot="${escapeAttr(g.bot)}" data-you="${escapeAttr(g.you)}" data-chip="${escapeAttr(g.chip)}" style="object-position:${g.pos}" />`
  ).join("");
  const glassCaps = GLASS.map(
    (g, i) =>
      `<button type="button" role="tab" class="${i === 0 ? "is-on" : ""}" data-glass-to="${i}" aria-selected="${i === 0 ? "true" : "false"}" aria-label="Show ${g.cap}"><span class="gn">${g.num}</span>${g.cap}</button>`
  ).join("");
  const g0 = GLASS[0];
  return `
    <section class="launch${reduceMotion ? " is-live is-apogee is-held" : ""}" id="home" data-launch>
      <div class="launch-sky" aria-hidden="true">${sparks}</div>
      <div class="launch-grid">
        <div class="launch-copy">
          <div class="blk blk-title">
            <p class="eyebrow reveal r1">Constellation · one box. two operators.</p>
            <h1 class="launch-title">
              <span class="launch-line reveal r2">Take Grok Bot to</span>
              <span class="wordmark reveal r3" role="img" aria-label="MaxQ"><span class="wordmark-ink pastel-flow"></span></span>
            </h1>
          </div>
          <div class="blk blk-claim">
            <p class="claim reveal r4">A co-operating system for your bot and you.</p>
            <p class="lede reveal r4">One command on the bot's computer. The stock box becomes a workstation tailored for the bot. You keep the side door.</p>
            <div class="cta-row reveal r5">
              <a class="btn-solid" href="#install">Install</a>
              <a class="btn-ghost" href="#how">See how it works</a>
            </div>
          </div>
          <dl class="blk split late l1" data-split>
            <div>
              <dt>The bot gets</dt>
              <dd data-split-bot>${g0.bot}</dd>
            </div>
            <div>
              <dt>You get</dt>
              <dd data-split-you>${g0.you}</dd>
            </div>
          </dl>
          <div class="blk glass late l2" data-glass>
            <a class="glass-well" data-glass-link href="${g0.href}">
              ${glassFrames}
              <span class="glass-chip" data-glass-chip>${g0.chip}</span>
            </a>
            <div class="glass-caps" role="tablist">${glassCaps}</div>
          </div>
        </div>
        <div class="launch-stage">
          <span class="ignition" aria-hidden="true"></span>
          ${stage}
        </div>
      </div>
      <ul class="telemetry" aria-label="MaxQ state">${telemetry}</ul>
      <a class="scroll-cue reveal r7" href="#how" aria-label="Scroll to how it works"><span></span></a>
    </section>`;
}

export function renderHome(): string {
  const tabs = surfaces
    .map(
      (s, i) =>
        `<button type="button" class="tab${i === 0 ? " active" : ""}" data-tab="${s.id}"><span class="tab-num">${s.num}</span>${s.label}</button>`
    )
    .join("");
  const panels = surfaces
    .map(
      (s, i) => `
      <div class="panel${i === 0 ? " active" : ""}" data-panel="${s.id}" ${i === 0 ? "" : "hidden"}>
        <div class="panel-copy">
          <p class="eyebrow">${s.num} · ${s.label}</p>
          <h3>${s.title}</h3>
          <p class="lede">${s.lede}</p>
          <a class="btn-ghost" href="${s.href}">Open ${s.label}</a>
        </div>
        <figure class="screen">
          <div class="screen-frame"><img src="${s.src}" alt="${escapeAttr(s.alt)}" width="${s.w}" height="${s.h}" loading="lazy" style="object-position:${s.pos}" /></div>
          <figcaption>${s.cap}</figcaption>
        </figure>
      </div>`
    )
    .join("");
  return `
    ${renderLaunch()}
    <div class="install-bar">${installLine()}</div>

    <section class="how" id="how">
      <div class="how-copy">
        <p class="eyebrow">How it works</p>
        <h2 class="display">One box. Two operators.</h2>
        <p class="lede">MaxQ is the build package for the computer Grok Bot runs on. One command turns a stock Linux box into the bot's workstation, and gives you a side door into it.</p>
        <ol class="steps">
          <li><span class="step-num">01</span><div><h3>Install</h3><p>The installer drops <code>maxq</code> into <code>$HOME/bin</code> and runs <code>apply</code>. Apply is idempotent: run it twice, the second run changes nothing.</p></div></li>
          <li><span class="step-num">02</span><div><h3>Apply builds the desk</h3><p>Mocha theme across wallpaper, GTK, cursors, Chrome, and Ghostty. A launcher on Super + Space. herdr, grok, codex, claude, opencode, fx, tailscale in <code>$HOME/bin</code>. Then <code>maxq-api</code> starts on loopback.</p></div></li>
          <li><span class="step-num">03</span><div><h3>You use the side door</h3><p><code>127.0.0.1:7432</code>: status, settings, resources, triggers, the proxy, and every desktop on the box. You steer without taking the box hostage.</p></div></li>
          <li><span class="step-num">04</span><div><h3>Prove or revert</h3><p><code>maxq prove</code> runs revert → apply → assert and leaves the box <code>APPLIED</code>. <code>maxq revert</code> removes what MaxQ owns and nothing else.</p></div></li>
        </ol>
        <p class="cmds"><code>maxq apply</code><code>maxq status</code><code>maxq prove</code><code>maxq revert</code><code>maxq proxy on|off</code></p>
      </div>
      ${plate("/art/hero-laptop.webp", "The box: a laptop with the bot's editor and telemetry on the glass", "plate-box")}
    </section>

    <section class="beat beat-desk" id="desk">
      <div class="beat-head">
        <div>
          <p class="eyebrow">01 · The bot's desk</p>
          <h2 class="display">A desk built for the bot.</h2>
        </div>
        <div>
          <p class="lede">It arrives knowing how to use a computer. Terminal, browser, desktops, theme, and the skills to drive them are in place before the first task. No week of onboarding. No stock image to figure out.</p>
          <dl class="split">
            <div>
              <dt>The bot gets</dt>
              <dd>A workstation shaped around how it works. Computer-use skills that fit the tools on the box, so it stops tripping over them.</dd>
            </div>
            <div>
              <dt>You get</dt>
              <dd>An assistant that hits the ground running, on your network. Join the herdr session and watch the work, not the transcript.</dd>
            </div>
          </dl>
        </div>
      </div>
      ${cine("/shots/bots-desk-cine.webp", "The bot's MaxQ desk: mocha wallpaper, rofi launcher, Ghostty at box@grokbot", 1079, 490, "maxq · the bot's desk", "box@grokbot")}
    </section>

    <section class="kit" id="kit">
      <div class="section-head kit-head">
        <div>
          <p class="eyebrow">What lands on the box</p>
          <h2 class="display">Everything the bot needs. Nothing it shouldn't have.</h2>
        </div>
        <p class="lede">This is the inventory <code>maxq apply</code> puts in place. All of it under <code>$HOME</code>. A tool with no official linux amd64 build is skipped and recorded in <code>clis.txt</code>, not faked.</p>
      </div>
      <div class="kit-grid">${KIT.map(kitGroup).join("")}</div>
    </section>

    <section class="beat beat-door" id="door">
      <div class="beat-head has-plate">
        ${plate("/art/ops.webp", "The operator deck: three desktops stacked above one control panel", "plate-deck")}
        <div>
          <p class="eyebrow">02 · The side door</p>
          <h2 class="display">Chat is a fine steering wheel. Until something goes wrong.</h2>
          <p class="lede">The desk gives the bot its tools. The side door gives you yours: nine desktops on one sheet, telemetry, process kill, a TUI on the box. All on loopback. Not a sidecar. A side door.</p>
          <dl class="split">
            <div>
              <dt>The bot gets</dt>
              <dd>Structure and a stable box. A RAM problem is a RAM problem, not a mysterious AI failure.</dd>
            </div>
            <div>
              <dt>You get</dt>
              <dd>Telemetry, visibility, control. Point the box at your own router. Install a skill without a prompt essay.</dd>
            </div>
          </dl>
        </div>
      </div>
      ${cine("/shots/desktops-eva-cine.webp", "MaxQ operator desktops: nine live sessions and the STREAM sidebar", 1600, 727, "maxq · the side door", "14 / 22 live")}
    </section>

    <section class="trust" id="trust">
      <div class="trust-copy">
        <p class="eyebrow">Invariants</p>
        <h2 class="display">What MaxQ owns. What it refuses to own.</h2>
        <p class="lede">A bot's computer is still your computer. MaxQ draws the line at <code>$HOME</code> and proves it every time you ask.</p>
        <div class="owns">
          <dl>
            <dt class="ok">owns</dt>
            ${OWNS.map(([k, v]) => `<div><code>${k}</code><span>${v}</span></div>`).join("")}
          </dl>
          <dl>
            <dt class="no">refuses</dt>
            ${REFUSES.map(([k, v]) => `<div><code>${k}</code><span>${v}</span></div>`).join("")}
          </dl>
        </div>
      </div>
      <figure class="proof">
        <div class="proof-bar"><span>maxq prove</span><span>box@grokbot</span></div>
        <pre><code>${PROOF.map(([k, v]) => `<span class="pk">${k}</span>=<span class="pv${v === "PASS" || v === "APPLIED" ? " ok" : ""}">${v}</span>`).join("\n")}</code></pre>
        <figcaption><span>revert → apply → assert</span><span>leaves APPLIED</span></figcaption>
      </figure>
    </section>

    <section class="surfaces" id="surfaces">
      <div class="section-head">
        <p class="eyebrow">Constellation</p>
        <h2 class="display">Four surfaces. One stack.</h2>
      </div>
      <div class="tabs" role="tablist">${tabs}</div>
      <div class="panels">${panels}</div>
    </section>

    <section class="start" id="start">
      <p class="eyebrow">Ready</p>
      <h2 class="display">Install MaxQ on the stock box.</h2>
      <p class="lede">Apply the workstation. Keep the side door. Prove or revert whenever you need to.</p>
      ${installLine()}
      <div class="cta-row">
        <a class="btn-solid" href="#install">Install guide</a>
        <a class="btn-ghost" href="${GITHUB}">GitHub</a>
      </div>
    </section>`;
}

export function renderStack(): string {
  return `
    <article class="block">
      <p class="eyebrow">Constellation</p>
      <h1>One stack. <span class="grad">Four surfaces.</span></h1>
      <p class="lede">Router spends the seats. MaxQ makes the box persist. Cue and Crew are the native glass.</p>
    </article>
    <div class="device-row">
      ${bezel("/shots/router-dashboard.webp", "Constellation Router dashboard", "router · seats", "laptop", 1100, 535)}
      ${bezel("/shots/settings.webp", "MaxQ settings applied", "maxq · settings", "laptop", 1000, 624)}
      ${bezel("/shots/cue-macos.webp", "Cue macOS: MaxQ launch region on the canvas", "cue · macOS", "laptop", 1100, 682)}
    </div>`;
}

export function renderRouter(): string {
  return `
    <article class="block">
      <p class="eyebrow">01 · Router</p>
      <h1>Make every <span class="grad">seat</span> count.</h1>
      <p class="lede">Constellation Auto picks a model from seats you already pay for: how hard the job is, the cheapest remaining token, and how close that seat is to reset.</p>
    </article>
    ${bezel("/shots/router-dashboard.webp", "Constellation Router dashboard: seats, included usage, reset clocks", "operations · dashboard", "laptop", 1100, 535)}
    <div class="grid three">
      <section><h2>Hard jobs</h2><p>Spend the expensive seat when the work is actually hard.</p></section>
      <section><h2>Cheap remainder</h2><p>Mid-cycle, hoard Sol. Burn Luna or Grok on routine work.</p></section>
      <section><h2>Reset clock</h2><p>Near reset, spend tokens that are about to vanish.</p></section>
    </div>
    ${shot("/shots/router-seats.webp", "Constellation Router seats table", "seats · linked", 900, 420)}`;
}

export function renderCue(): string {
  return `
    <article class="block">
      <p class="eyebrow">03 · Cue</p>
      <h1><span class="grad">Cue</span> is native glass.</h1>
      <p class="lede">Swift/SwiftUI chat-and-steer for macOS. iOS still landing.</p>
    </article>
    <div class="device-row one">
      ${bezel("/shots/cue-macos.webp", "Cue macOS: MaxQ launch region on the canvas, inspector and filmstrip", "cue · macOS", "laptop", 1100, 682)}
    </div>
    <div class="device-row one">
      ${bezel("/shots/cue-macos-2.webp", "Cue macOS 3-pane, MuxBot Hello world, Multiplexer host and agents", "cue · macOS", "laptop", 1006, 635)}
    </div>`;
}

export function renderCrew(): string {
  return `
    <article class="block">
      <p class="eyebrow">04 · Crew</p>
      <h1><span class="grad">Crew</span> steers computers.</h1>
      <p class="lede">Cue-like SwiftUI with pluggable ComputerProviders: local Docker/VZ, Proxmox, AWS/EC2, Connect-Mac. Chat stays in Crew. The box is a provider.</p>
    </article>
    <div class="device-row one">
      ${bezel("/shots/crew-macos.webp", "Crew macOS: Messages, MuxBot, Multiplexer", "crew · macOS", "laptop", 1006, 670)}
    </div>`;
}

export function renderInstall(): string {
  return `
    <article class="block">
      <p class="eyebrow">Install</p>
      <h1>From stock.</h1>
      <p class="lede">The installer copies <code>maxq</code> into <code>$HOME/bin</code> and runs apply. Apply is idempotent. Prove runs revert → apply → assert and leaves APPLIED.</p>
      ${installLine()}
    </article>
    ${shot("/shots/prove.webp", "maxq prove PASS on grokbot", "maxq prove · result=PASS · intercept=false", 900, 562)}
    ${shot("/shots/rofi.webp", "Rofi Super+Space", "launcher · Super+Space", 1000, 625)}
    <article class="block"><h2>Commands</h2><table class="cli"><thead><tr><th>command</th><th>does</th></tr></thead><tbody>
      <tr><td>maxq status</td><td class="dim">applied | reverted</td></tr>
      <tr><td>maxq apply</td><td class="dim">configure (idempotent)</td></tr>
      <tr><td>maxq revert</td><td class="dim">unconfigure MaxQ-owned files only</td></tr>
      <tr><td>maxq prove</td><td class="dim">revert/apply/assert cycle; leaves APPLIED</td></tr>
      <tr><td>maxq proxy</td><td class="dim">GOST settings (local process only)</td></tr>
    </tbody></table></article>`;
}

export function renderInvariants(): string {
  return `
    <article class="block">
      <p class="eyebrow">Invariants</p>
      <h1>The box can come apart.</h1>
      <p class="lede">MaxQ is the load line, not a hostage-taking dotfile run. Revert is part of the product.</p>
      <ul class="inv">
        <li>Persist only under $HOME — bin, .config/maxq, .local</li>
        <li>Never write Chrome ProxyMode / ProxyServer / managed policy</li>
        <li>GOST intercept defaults false</li>
        <li>Revert does not delete $HOME, SSH keys, Chrome profiles, or the persist CA</li>
        <li>API refuses non-loopback binds</li>
      </ul>
    </article>
    ${shot("/shots/plank.webp", "Plank dock with ChatGPT Claude Grok Slack Discord Ghostty", "dock · mocha icons", 900, 562)}
    ${shot("/shots/chrome-mocha.webp", "Chrome mocha toolbar", "chrome · mocha", 900, 562)}`;
}

export function renderOps(): string {
  return `
    <article class="block">
      <p class="eyebrow">Ops</p>
      <h1>Control API</h1>
      <p class="lede">Go stdlib + embedded mocha sheet. apply starts it. revert stops it. No auth beyond localhost.</p>
    </article>
    ${bezel("/shots/settings.webp", "MaxQ settings Defaults", "GET / · applied · Ghostty 1.3.1", "laptop", 1000, 624)}
    <table class="cli"><thead><tr><th>route</th><th>notes</th></tr></thead><tbody>
      <tr><td>GET /</td><td class="dim">thin settings sheet</td></tr>
      <tr><td>GET /status</td><td class="dim">applied, theme, gost, clis</td></tr>
      <tr><td>POST /apply</td><td class="dim">runs maxq apply</td></tr>
      <tr><td>POST /revert</td><td class="dim">200 then the process exits</td></tr>
    </tbody></table>`;
}