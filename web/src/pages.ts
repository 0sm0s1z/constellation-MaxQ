export type Route = "home" | "stack" | "router" | "cue" | "crew" | "install" | "invariants" | "ops";
export const INSTALL =
  "curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash";
export const GITHUB = "https://github.com/0sm0s1z/constellation-MaxQ";

export function parseRoute(): Route {
  const hash = (location.hash || "#home").replace("#", "");
  const known: Route[] = ["home", "stack", "router", "cue", "crew", "install", "invariants", "ops"];
  return (known as string[]).includes(hash) ? (hash as Route) : "home";
}

const installLine = () => `
  <div class="term"><code><span class="ps1">$</span><span class="cmd">${INSTALL}</span><span class="cursor"></span></code><button class="copy" type="button" data-copy="${INSTALL}">copy</button></div>`;

const shot = (src: string, alt: string, caption: string, w: number, h: number) => `
  <figure class="shot"><img src="${src}" alt="${alt}" width="${w}" height="${h}" /><figcaption>${caption}</figcaption></figure>`;

const bezel = (src: string, alt: string, caption: string, kind: "laptop" | "phone" = "laptop", w = 1280, h = 800) => `
  <figure class="bezel ${kind}">
    <div class="chrome"><span></span><span></span><span></span></div>
    <img src="${src}" alt="${alt}" width="${w}" height="${h}" />
    <figcaption>${caption}</figcaption>
  </figure>`;

const surfaces = [
  {
    id: "router",
    num: "01",
    label: "Router",
    title: "Make every seat count.",
    lede: "Constellation Auto picks a model from seats you already pay for: how hard the job is, the cheapest remaining token, and how close that seat is to reset.",
    src: "/shots/router-dashboard.webp",
    alt: "Constellation Router dashboard: seats, included usage, reset clocks",
    cap: "router · operations",
    w: 1100,
    h: 535,
    href: "#router",
  },
  {
    id: "maxq",
    num: "02",
    label: "MaxQ",
    title: "The computer Grok Bot runs on.",
    lede: "Utilities for the bot. Secondary controls for you: settings, telemetry, processes, every desktop.",
    src: "/shots/desktops.webp",
    alt: "MaxQ desktops multiplexer, live Xvfb :1 through :15, current :5",
    cap: "maxq · desktops",
    w: 1037,
    h: 1200,
    href: "#home",
  },
  {
    id: "cue",
    num: "03",
    label: "Cue",
    title: "Native glass. Not an Electron fork.",
    lede: "Swift/SwiftUI chat-and-steer for macOS. iOS still landing.",
    src: "/shots/cue-macos.webp",
    alt: "Cue macOS: Messages, MuxBot chat, Multiplexer assigns computers",
    cap: "cue · macOS",
    w: 1006,
    h: 670,
    href: "#cue",
  },
  {
    id: "crew",
    num: "04",
    label: "Crew",
    title: "Chat stays in Crew. The box is a provider.",
    lede: "Cue-like SwiftUI with pluggable ComputerProviders: local Docker/VZ, Proxmox, AWS/EC2, Connect-Mac.",
    src: "/shots/crew-macos.webp",
    alt: "Crew macOS: Messages, MuxBot, Multiplexer",
    cap: "crew · macOS",
    w: 1006,
    h: 670,
    href: "#crew",
  },
];

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
const GLASS: { src: string; w: number; h: number; alt: string; num: string; cap: string; tele: string }[] = [
  { src: "/shots/maxq-desktop.webp", w: 1100, h: 687, alt: "The bot's desktop on MaxQ: browser, Ghostty terminal, mocha dock", num: "01", cap: "the bot's desk", tele: "state" },
  { src: "/shots/settings.webp", w: 1000, h: 624, alt: "MaxQ settings sheet on 127.0.0.1:7432, state applied", num: "02", cap: "the side door", tele: "intercept" },
  { src: "/shots/prove.webp", w: 900, h: 562, alt: "maxq prove report: result=PASS, left_state=APPLIED", num: "03", cap: "prove · PASS", tele: "prove" },
];

function renderLaunch(): string {
  const reduceMotion =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const alt = "MaxQ launch: a rocket lifting off a laptop";
  const still = `<img class="launch-still" src="/art/maxq-launch-still.webp" alt="${alt}" width="1024" height="1180" />`;
  const stage = reduceMotion
    ? still
    : `
        <video class="launch-video" autoplay muted playsinline width="1024" height="1180" poster="/art/maxq-launch-still.webp" aria-label="${alt}">
          <source src="/art/maxq-launch.webm" type="video/webm" />
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
      `<img class="${i === 0 ? "is-on" : ""}" src="${g.src}" alt="${g.alt}" width="${g.w}" height="${g.h}" loading="${i === 0 ? "eager" : "lazy"}" data-tele="${g.tele}" />`
  ).join("");
  const glassCaps = GLASS.map(
    (g, i) =>
      `<button type="button" class="${i === 0 ? "is-on" : ""}" data-glass-to="${i}" aria-label="Show ${g.cap}"><span class="gn">${g.num}</span>${g.cap}</button>`
  ).join("");
  return `
    <section class="launch${reduceMotion ? " is-live is-apogee is-held" : ""}" data-launch>
      <div class="launch-sky" aria-hidden="true">${sparks}</div>
      <div class="launch-grid">
        <div class="launch-copy">
          <div class="blk blk-title">
            <p class="eyebrow reveal r1">Constellation · first product</p>
            <h1 class="launch-title">
              <span class="launch-line reveal r2">Take Grok Bot to</span>
              <span class="wordmark reveal r3" role="img" aria-label="MaxQ"><span class="wordmark-ink pastel-flow"></span></span>
            </h1>
          </div>
          <div class="blk blk-claim">
            <p class="claim reveal r4">A co-operating system for your bot and you.</p>
            <p class="lede reveal r4">One command on the bot's computer. The stock box becomes a workstation built for the bot. You keep the side door.</p>
            <div class="cta-row reveal r5">
              <a class="btn-solid" href="#install">Install</a>
              <a class="btn-ghost" href="#how">See how it works</a>
            </div>
          </div>
          <dl class="blk split late l1">
            <div>
              <dt>The bot gets</dt>
              <dd>A computer made for it. Terminal, browser, desktops, theme, and its CLIs in place before the first task.</dd>
            </div>
            <div>
              <dt>You get</dt>
              <dd>The side door: settings, telemetry, processes, every desktop. Loopback only. Revert leaves the box standing.</dd>
            </div>
          </dl>
          <div class="blk glass late l2" data-glass>
            <div class="glass-frame">${glassFrames}</div>
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
        ${s.src
          ? bezel(s.src, s.alt, s.cap, "laptop", s.w, s.h)
          : `<figure class="bezel empty"><div class="chrome"><span></span><span></span><span></span></div><p class="ph">Crew screenshot landing. Not Cue.</p><figcaption>${s.cap}</figcaption></figure>`}
      </div>`
    )
    .join("");
  return `
    ${renderLaunch()}
    <div class="install-bar">${installLine()}</div>
    <section class="how" id="how">
      <div class="how-copy">
        <p class="eyebrow">How it works</p>
        <h2 class="display">One box. Operator and bot.</h2>
        <ol class="steps">
          <li><span class="step-num">01</span><div><h3>Packages</h3><p>SBOM inventory for the bot: go, node, docker, ghostty, grok, claude. Not apt. Does not mutate packages.</p></div></li>
          <li><span class="step-num">02</span><div><h3>Operator glass</h3><p>Settings on loopback. Side-saddle the bot. Configure the machine without taking it hostage.</p></div></li>
          <li><span class="step-num">03</span><div><h3>Desktops</h3><p>Live Xvfb through the noVNC multiplexer. :1–:15. View, switch, this desktop.</p></div></li>
          <li><span class="step-num">04</span><div><h3>Persist</h3><p>Only <code>$HOME</code>. Revert does not delete the machine. Prove leaves APPLIED.</p></div></li>
        </ol>
      </div>
      ${bezel("/shots/collage.webp", "MaxQ operator glass: desktops multiplexer, settings, packages, OpenCode", "maxq · desktops, settings, packages", "laptop", 900, 1059)}
    </section>
    <section class="surfaces" id="surfaces">
      <div class="section-head">
        <p class="eyebrow">Constellation</p>
        <h2 class="display">Four surfaces. One stack.</h2>
      </div>
      <div class="tabs" role="tablist">${tabs}</div>
      <div class="panels">${panels}</div>
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
      ${bezel("/shots/cue-macos.webp", "Cue chat-and-steer on macOS", "cue · macOS", "laptop", 1006, 670)}
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
      ${bezel("/shots/cue-macos.webp", "Cue macOS: Messages, MuxBot chat, Multiplexer assigns computers", "cue · macOS", "laptop", 1006, 612)}
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