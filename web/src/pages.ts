import { kitIcons, type KitIcon } from "./icons/pack";

export type Route =
  | "home" | "stack" | "router" | "cue" | "crew" | "install" | "invariants" | "ops" | "frontier"
  | "access" | "control" | "telemetry";
export const INSTALL =
  "curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash";
export const GITHUB = "https://github.com/0sm0s1z/constellation-MaxQ";

const HOME_HASHES = new Set(["", "home", "desk", "door", "how", "kit", "console", "trust", "why", "surfaces", "start"]);
const KNOWN: Route[] = [
  "home", "stack", "router", "cue", "crew", "install", "invariants", "ops", "frontier",
  "access", "control", "telemetry",
];

export function parseRoute(): Route {
  const hash = (location.hash || "#home").replace("#", "");
  if (HOME_HASHES.has(hash)) return "home";
  return (KNOWN as string[]).includes(hash) ? (hash as Route) : "home";
}

/* Why MaxQ. Three pages that follow the front page: the front page says what the box is, these say
   why it matters. Order is the journey — get the bot onto your network safely, give it hands and
   skills, then watch all of it. `WHY` drives the home navigator, the topbar, and `why.ts`. */
export type WhyId = "access" | "control" | "telemetry";
export type WhyTint = "green" | "peach" | "sky";
export type Why = {
  id: WhyId; num: string; label: string; short: string; tint: WhyTint;
  title: string; one: string; points: string[]; art: string; artAlt: string; artKind: string;
};
export const WHY: Why[] = [
  {
    id: "access", num: "01", label: "Access & security", short: "access", tint: "green",
    title: "Get the bot onto your network. Without opening a hole.",
    one: "A tailnet in the apply. A firewall by port and by source. A vault so the bot can log in without ever seeing the key.",
    points: ["tailnet, not port-forwarding", "inbound by port · by source", "vault + oauth, never pasted"],
    art: "/art/hero-orbit.webp", artAlt: "Orbit rings: the tailnet wrapping the box", artKind: "plate-orbit",
  },
  {
    id: "control", num: "02", label: "Control & extension", short: "control", tint: "peach",
    title: "Everything a user of that computer could do. From your browser.",
    one: "Skills on and off per bot. Files up and down. Processes trimmed, restarted, killed. The box's inventory, in plain sight.",
    points: ["skills · assign, enable, update", "files · browse, upload, download", "processes · trim, restart, kill"],
    art: "/art/desk.webp", artAlt: "The bot's desk: laptop, side screens, a control deck", artKind: "plate-desk",
  },
  {
    id: "telemetry", num: "03", label: "Monitoring & telemetry", short: "telemetry", tint: "sky",
    title: "See what every bot is doing. All of them. At once.",
    one: "Every desktop live on one sheet. RAM, CPU, load by agent. Triggers that page you before the box falls over.",
    points: ["every desktop · one sheet", "ram · cpu · load, per agent", "triggers · schedule, probe, webhook"],
    art: "/art/ops.webp", artAlt: "The operator deck: three desktops stacked above one control panel", artKind: "plate-deck",
  },
];

const whyCard = (w: Why) => `
  <li class="why-card" data-tint="${w.tint}">
    <a href="#${w.id}">
      <span class="why-num">${w.num}</span>
      <span class="why-dot" aria-hidden="true"></span>
      <h3>${escapeHtml(w.label)}</h3>
      <p>${escapeHtml(w.one)}</p>
      <ul class="why-points">${w.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
      <span class="why-go">Read <i aria-hidden="true">→</i></span>
    </a>
  </li>`;

export const renderWhyNav = () => `
    <section class="why" id="why">
      <div class="section-head why-head">
        <div>
          <p class="eyebrow">Why MaxQ</p>
          <h2 class="display">Above: what it is. Next: why it matters.</h2>
        </div>
        <p class="lede">Three pages, one journey. Get the bot onto your network without opening a hole. Give it hands and skills. Then watch all of it work.</p>
      </div>
      <ol class="why-rail" data-reveal>${WHY.map(whyCard).join("")}</ol>
    </section>`;

const installLine = () => `
  <div class="term"><code><span class="ps1">$</span><span class="cmd">${INSTALL}</span><span class="cursor"></span></code><button class="copy" type="button" data-copy="${INSTALL}">copy</button></div>`;

export const shot = (src: string, alt: string, caption: string, w: number, h: number) => `
  <figure class="shot"><img src="${src}" alt="${alt}" width="${w}" height="${h}" /><figcaption>${caption}</figcaption></figure>`;

const escapeAttr = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
export const cine = (src: string, alt: string, w: number, h: number, left: string, right: string) => `
  <figure class="cine">
    <div class="cine-frame"><img src="${src}" alt="${escapeAttr(alt)}" width="${w}" height="${h}" loading="lazy" /></div>
    <figcaption><span>${left}</span><span>${right}</span></figcaption>
  </figure>`;

/* The bot's desk below the fold is a macOS-dark window: traffic-light chrome, then a 16:9
   screen that starts on the wallpaper's pastel line (host titlebar cropped off). Hero glass
   keeps the thinner wall + dock overlay and does not use this frame. */
const DESK_WALL = { src: "/shots/bots-desk-wall.webp", w: 1093, h: 670 };
const DESK_STAGE = { src: "/shots/bots-desk-stage.webp", w: 1093, h: 558 };
const DESK_DOCK = { src: "/shots/bots-desk-dock.webp", w: 1093, h: 76 };
const deskBar = () => `
  <div class="desk-menubar" aria-hidden="true">
    <span class="desk-brand">MaxQ</span>
    <span class="desk-mod">mocha</span>
    <span class="desk-host">box@grokbot</span>
  </div>`;
const deskStage = (left: string, right: string) => `
  <figure class="desk">
    <div class="desk-window">
      <div class="desk-chrome" aria-hidden="true">
        <span></span><span></span><span></span>
        <span class="desk-chrome-title">box@grokbot</span>
      </div>
      <div class="desk-screen" data-desk>
        <img class="desk-wall" src="${DESK_STAGE.src}" alt="The bot's MaxQ desk: mocha wallpaper, rofi launcher, Ghostty at box@grokbot" width="${DESK_STAGE.w}" height="${DESK_STAGE.h}" loading="lazy" />
        <img class="desk-dock" src="${DESK_DOCK.src}" alt="" width="${DESK_DOCK.w}" height="${DESK_DOCK.h}" />
        <span class="desk-hint"><kbd>Super</kbd><span>+</span><kbd>Space</kbd> launcher</span>
      </div>
    </div>
    <figcaption><span>${left}</span><span>${right}</span></figcaption>
  </figure>`;

/* Art plate: pastel isometric art flat on the canvas, feathered into the crust. No chrome. */
export const plate = (src: string, alt: string, kind: string) => `
  <figure class="plate ${kind}"><img src="${src}" alt="${escapeAttr(alt)}" width="1280" height="853" loading="lazy" /></figure>`;

/* The kit. What `maxq apply` actually puts on the box, grouped the way the box is used.
   Marks are the Mocha icon pack in `src/icons`. Each tile has a one-line purpose (`tip`)
   for the glass hover. Facts follow README + docs/CLIS.md + docs/THEME.md + docs/API.md. */
type KitTint = "mauve" | "peach" | "sky" | "green" | "pink" | "lavender" | "rosewater" | "blue" | "teal" | "yellow";
type KitItem = { name: string; icon: KitIcon; tint: KitTint; tip: string; tag?: string };
type KitGroup = { id: string; eyebrow: string; title: string; note: string; items: KitItem[] };
const KIT: KitGroup[] = [
  {
    id: "desk", eyebrow: "The desk", title: "The bot's tools",
    note: "Theme, terminal, launcher, browser. The same every box.",
    items: [
      { name: "Catppuccin Mocha", icon: "catppuccin", tint: "mauve", tag: "theme",
        tip: "The desk's skin. Wallpaper, GTK, cursors — Mocha on every box." },
      { name: "Chrome", icon: "chrome", tint: "yellow", tag: "$HOME only",
        tip: "The bot's browser, already Mocha. Profiles stay in $HOME." },
      { name: "Ghostty", icon: "ghostty", tint: "lavender", tag: "config-only",
        tip: "The terminal it lives in. One Mocha block; your config around it stays." },
      { name: "rofi", icon: "rofi", tint: "pink", tag: "launcher",
        tip: "Super + Space. The launcher the bot already knows how to drive." },
    ],
  },
  {
    id: "bench", eyebrow: "The bench", title: "The operator CLIs",
    note: "The agents' tools. Revert knows which it owns.",
    items: [
      { name: "herdr", icon: "herdr", tint: "yellow",
        tip: "An agentic multiplexer. You and your agents share the same terminals, over the network." },
      { name: "Grok CLI", icon: "grok", tint: "sky",
        tip: "Grok from the shell. Search, query, a model the bot can call." },
      { name: "Codex", icon: "codex", tint: "teal",
        tip: "OpenAI's coding agent, on the box. It can write and run." },
      { name: "Claude Code", icon: "claude", tint: "peach",
        tip: "Anthropic's coding agent. Same bench, another pair of hands." },
      { name: "OpenCode", icon: "opencode", tint: "blue",
        tip: "A coding agent that lives on the box. No cloud seat required." },
      { name: "Vercel fx", icon: "vercel", tint: "pink",
        tip: "Tiny tools from the shell. The bot can call a function without opening a browser." },
      { name: "Tailscale", icon: "tailscale", tint: "green",
        tip: "The box on your tailnet. Reach the desk without opening the house." },
    ],
  },
  {
    id: "door", eyebrow: "The side door", title: "Your controls",
    note: "Loopback. Not an admin suite.",
    items: [
      { name: "maxq-api", icon: "maxq", tint: "peach", tag: "loopback",
        tip: "Status, apply, revert. Binds 127.0.0.1 — not the public internet." },
      { name: "Desktops", icon: "desktops", tint: "lavender", tag: "live",
        tip: "Every X display on one sheet. Watch the hands, not the transcript." },
      { name: "Resources", icon: "resources", tint: "sky", tag: "telemetry",
        tip: "RAM, CPU, the agent processes. Kill from here when chat isn't enough." },
      { name: "GOST", icon: "gost", tint: "yellow", tag: "off by default",
        tip: "A local CONNECT proxy. Off until you flip it. No MITM by default." },
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

const kitTile = (it: KitItem) => {
  const id = `kit-tip-${it.icon}`;
  return `
  <li class="kit-tile" data-tint="${it.tint}" tabindex="0" aria-describedby="${id}">
    <span class="kit-mark">${kitIcons[it.icon]}</span>
    <strong>${escapeHtml(it.name)}</strong>
    ${it.tag ? `<span class="kit-tag">${escapeHtml(it.tag)}</span>` : ""}
    <span class="kit-tip" role="tooltip" id="${id}">${escapeHtml(it.tip)}</span>
  </li>`;
};

/* The console. Block two of the side door: the sheet at 127.0.0.1:7432 as live type, not a
   raster. Three panels — desktops, resources, steer — each one you can put a hand on.
   Numbers start where the EVA capture was (14 / 22 live, RAM 69%, CPU 61%) and move from there. */
type Desktop = { id: number; live: boolean; wall: 1 | 2 | 3; win?: "browser" | "term" | "wide" };
const DESKTOPS: Desktop[] = [
  { id: 1, live: true, wall: 1 },
  { id: 3, live: true, wall: 2, win: "browser" },
  { id: 5, live: true, wall: 1 },
  { id: 7, live: true, wall: 3 },
  { id: 8, live: true, wall: 2, win: "term" },
  { id: 9, live: true, wall: 1 },
  { id: 11, live: false, wall: 3 },
  { id: 16, live: false, wall: 2 },
  { id: 22, live: true, wall: 1, win: "wide" },
];
type Proc = { name: string; gb: number; cpu: number; icon: KitIcon };
const PROCS: Proc[] = [
  { name: "chrome", gb: 3.4, cpu: 22, icon: "chrome" },
  { name: "codex", gb: 2.1, cpu: 18, icon: "codex" },
  { name: "claude", gb: 1.7, cpu: 11, icon: "claude" },
  { name: "grok", gb: 1.2, cpu: 7, icon: "grok" },
];
const RAM_TOTAL_GB = 15.6;
const RAM_BASE_GB = 2.3;
const ramUsed = () => RAM_BASE_GB + PROCS.reduce((n, p) => n + p.gb, 0);

const desktopTile = (d: Desktop, i: number) => `
  <button class="dtile w${d.wall}${d.live ? " is-live" : ""}${i === 2 ? " is-current" : ""}" type="button" data-tile="${d.id}" ${d.live ? "" : "disabled"} aria-label="desktop :${d.id}${d.live ? "" : ", idle"}">
    <span class="dtile-id">:${d.id}</span>
    <span class="dtile-chip">${d.live ? "live" : "idle"}</span>
    ${d.win ? `<span class="dtile-win ${d.win}"></span>` : ""}
    <span class="dtile-dock"><i></i><i></i><i></i><i></i><i></i></span>
  </button>`;

const procRow = (p: Proc) => `
  <li class="proc" data-proc="${p.name}" data-gb="${p.gb}" data-cpu="${p.cpu}">
    <span class="proc-mark">${kitIcons[p.icon]}</span>
    <code class="proc-name">${p.name}</code>
    <span class="proc-gb">${p.gb.toFixed(1)} GB</span>
    <button class="proc-kill" type="button" data-kill="${p.name}">kill</button>
  </li>`;

export const renderConsole = (head = true) => {
  const used = ramUsed();
  const ramPct = Math.round((used / RAM_TOTAL_GB) * 100);
  return `
    <section class="console${head ? "" : " console-bare"}" id="console">
      ${head ? `<div class="section-head console-head">
        <div>
          <p class="eyebrow">Through the side door</p>
          <h2 class="display">Watch it. Meter it. Steer it.</h2>
        </div>
        <p class="lede">This is the sheet at <code>127.0.0.1:7432</code>, as live type. Every desktop on the box, the meters, the switches. Put a hand on it.</p>
      </div>` : ""}
      <div class="console-grid" data-console>
        <figure class="console-panel" data-kind="desktops">
          <div class="console-bar"><span>desktops</span><span class="console-live" data-live-count>14 / 22 live</span></div>
          <div class="sheet" data-sheet>${DESKTOPS.map(desktopTile).join("")}</div>
          <figcaption><span>current <b data-current>:5</b></span><span>every X display · noVNC</span></figcaption>
        </figure>

        <figure class="console-panel" data-kind="resources">
          <div class="console-bar"><span>resources</span><span class="console-clock" data-clock>11:00:14</span></div>
          <div class="meters">
            <div class="meter" data-meter="cpu"><span class="meter-k">cpu</span><span class="meter-v"><b data-meter-v>61</b>%</span><span class="bar"><i style="--v:61%"></i></span></div>
            <div class="meter" data-meter="ram"><span class="meter-k">ram</span><span class="meter-v"><b data-meter-v>${ramPct}</b>% <small data-ram-gb>${used.toFixed(1)} / ${RAM_TOTAL_GB} GB</small></span><span class="bar"><i style="--v:${ramPct}%"></i></span></div>
            <div class="meter" data-meter="load"><span class="meter-k">load</span><span class="meter-v"><b data-meter-v>5.5</b> <small>on 8 cores</small></span><span class="bar"><i style="--v:69%"></i></span></div>
          </div>
          <ul class="procs" data-procs>${PROCS.map(procRow).join("")}</ul>
          <ol class="console-log" data-log aria-live="polite"></ol>
          <figcaption><span>agent processes</span><button class="console-restore" type="button" data-restore hidden>restore</button></figcaption>
        </figure>

        <figure class="console-panel" data-kind="steer">
          <div class="console-bar"><span>steer</span><span class="console-state">state <b>applied</b></span></div>
          <ul class="switches">
            <li class="switch">
              <span class="switch-k">router</span>
              <span class="chips" role="radiogroup" aria-label="router">
                <button class="chip is-on" type="button" role="radio" aria-checked="true" data-route="auto">constellation auto</button>
                <button class="chip" type="button" role="radio" aria-checked="false" data-route="seat">grok seat</button>
              </span>
              <span class="switch-note" data-route-note>cheapest token that still finishes</span>
            </li>
            <li class="switch">
              <span class="switch-k">proxy</span>
              <button class="toggle" type="button" role="switch" aria-checked="false" data-toggle="proxy"><i></i></button>
              <span class="switch-note" data-toggle-note="proxy">off · <code>maxq proxy on</code></span>
            </li>
            <li class="switch">
              <span class="switch-k">intercept</span>
              <button class="toggle is-locked" type="button" role="switch" aria-checked="false" aria-disabled="true" data-toggle="intercept"><i></i></button>
              <span class="switch-note" data-toggle-note="intercept">false · the CA is documented, not auto-trusted</span>
            </li>
            <li class="switch">
              <span class="switch-k">skills</span>
              <button class="chip chip-add" type="button" data-skill>+ install computer-use</button>
              <span class="switch-note" data-skill-note>from the bot marketplace. no prompt essay.</span>
            </li>
          </ul>
          <figcaption><span>127.0.0.1:7432</span><span>loopback only</span></figcaption>
        </figure>
      </div>
    </section>`;
};

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
    src: DESK_WALL.src, w: DESK_WALL.w, h: DESK_WALL.h,
    alt: "The bot's MaxQ desk: mocha wallpaper, rofi launcher, Ghostty at box@grokbot",
    num: "01", cap: "the bot's desk", tele: "state", href: "#desk",
    bot: "A computer tailored for it. Terminal, browser, desktops, theme, and the skills to use them before the first task.",
    you: "An assistant that doesn't need onboarding. The desk is on your network. You can watch the herdr session.",
    chip: "box@grokbot", pos: "50% 18%",
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
      `<img class="glass-frame ${i === 0 ? "is-on" : ""}" src="${g.src}" alt="${g.alt}" width="${g.w}" height="${g.h}" loading="${i === 0 ? "eager" : "lazy"}" data-tele="${g.tele}" data-href="${g.href}" data-bot="${escapeAttr(g.bot)}" data-you="${escapeAttr(g.you)}" data-chip="${escapeAttr(g.chip)}" style="object-position:${g.pos}" />`
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
            <a class="glass-well is-desk" data-glass-link href="${g0.href}">
              ${glassFrames}
              ${deskBar()}
              <img class="desk-dock" src="${DESK_DOCK.src}" alt="" width="${DESK_DOCK.w}" height="${DESK_DOCK.h}" data-desk-dock />
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
      ${deskStage("maxq · the bot's desk", "box@grokbot")}
    </section>

    <section class="kit" id="kit">
      <div class="section-head kit-head">
        <div>
          <p class="eyebrow">What lands on the box</p>
          <h2 class="display">Everything the bot needs. Nothing it shouldn't have.</h2>
        </div>
        <p class="lede">What <code>maxq apply</code> puts on the box. Tools for the bot. A door for you. All of it under <code>$HOME</code>.</p>
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

    ${renderConsole()}

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

    ${renderWhyNav()}

    <section class="surfaces" id="surfaces">
      <div class="section-head">
        <p class="eyebrow">Constellation · Products</p>
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