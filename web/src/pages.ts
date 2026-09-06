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

const nameLogo = (cls: string) =>
  `<img class="${cls}" src="/namelogo.webp" alt="MaxQ" width="1319" height="318" />`;

const surfaces = [
  {
    id: "maxq",
    num: "02",
    label: "MaxQ",
    title: "Make the box persist.",
    lede: "Build package for Grok Bot's computer: workstation state for the bot, loopback controls for you.",
    src: "/shots/desktops.webp",
    alt: "MaxQ desktops multiplexer showing the bot computer desktops",
    cap: "maxq · desktops",
    w: 1037,
    h: 1200,
    href: "#home",
  },
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
        ${bezel(s.src, s.alt, s.cap, "laptop", s.w, s.h)}
      </div>`
    )
    .join("");
  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Constellation · one box · two operators</p>
        <h1>
          <span class="words pastel-flow">Take Grok Bot to</span>
          ${nameLogo("hero-logo")}
        </h1>
        <p class="lede"><strong>MaxQ is the build package for the computer Grok Bot runs on.</strong></p>
        <p class="lede">Install MaxQ on Grok Bot’s computer and it configures the workstation under <code>$HOME</code>: the desktop, theme, launcher, supported CLIs, and the local MaxQ control surface. The bot gets a stable place to work; you keep the side door for settings, visibility, processes, and every desktop on loopback. <code>maxq apply</code>, <code>status</code>, <code>prove</code>, and <code>revert</code> keep the state explicit, and revert removes MaxQ-owned state instead of taking over the machine.</p>
        <div class="cta-row">
          <a class="btn-solid" href="#install">Install</a>
          <a class="btn-ghost" href="#how">See how it works</a>
        </div>
      </div>
      <div class="hero-visual carousel" data-carousel data-carousel-lock>
        <div class="slides">
          <figure class="slide is-on rocket-slide" data-slide="0">
            <img
              class="hero-static-plate"
              src="/art/hero-static.webp"
              alt="Pastel MaxQ workstation launch plate"
              width="1448"
              height="1086"
            />
            <figcaption>01 · apply. install.sh takes the box to MaxQ.</figcaption>
          </figure>
          <figure class="slide" data-slide="1" hidden>
            <img src="/art/desk.webp" alt="Isometric agent workstation, code on the glass" width="1280" height="853" />
            <figcaption>02 · the computer the bot actually lives on.</figcaption>
          </figure>
          <figure class="slide" data-slide="2" hidden>
            <img src="/art/ops.webp" alt="Operator stack: three desktops, one control deck" width="1280" height="853" />
            <figcaption>03 · side door. telemetry, processes, every desktop.</figcaption>
          </figure>
        </div>
        <div class="dots" role="tablist">
          <button type="button" class="dot is-on" data-dot="0" aria-label="Slide 1"></button>
          <button type="button" class="dot" data-dot="1" aria-label="Slide 2"></button>
          <button type="button" class="dot" data-dot="2" aria-label="Slide 3"></button>
        </div>
      </div>
    </section>
    <div class="proof">
      <span>$HOME only</span>
      <span>127.0.0.1:7432</span>
      <span>apply / prove / revert</span>
    </div>
    <div class="install-bar">${installLine()}</div>

    <section class="block" id="actors">
      <div class="section-head">
        <p class="eyebrow">Two actors · one box</p>
        <h2 class="display">The bot gets the workstation. You keep the side door.</h2>
      </div>
      <div class="grid two">
        <section>
          <p class="eyebrow">The bot gets</p>
          <h3>A stable workstation.</h3>
          <p>Desktop, theme, launcher, browser and terminal environment, plus the supported CLIs and tools MaxQ manages under <code>$HOME</code>.</p>
          ${shot("/shots/maxq-desktop.webp", "MaxQ desktop on the Grok Bot workstation", "bot · configured workstation", 1000, 625)}
        </section>
        <section>
          <p class="eyebrow">You get</p>
          <h3>The local operator side door.</h3>
          <p>Settings, visibility, process control, and desktop control through the loopback MaxQ control surface.</p>
          ${shot("/shots/settings.webp", "MaxQ loopback settings surface", "operator · settings on loopback", 1000, 624)}
        </section>
      </div>
    </section>

    <section class="block" id="changes">
      <div class="section-head">
        <p class="eyebrow">What MaxQ changes</p>
        <h2 class="display">Three owned surfaces. Nothing imaginary.</h2>
      </div>
      <div class="grid three">
        <section>
          <h2>Workstation</h2>
          <p>MaxQ applies the desktop, theme, launcher, and supported CLI state the bot works from.</p>
          ${shot("/shots/ghostty.webp", "Ghostty configured with the MaxQ Mocha theme", "workstation · terminal state", 1000, 625)}
        </section>
        <section>
          <h2>Operator glass</h2>
          <p>A thin local control surface exposes settings and desktops without turning the box into an admin suite.</p>
          ${shot("/shots/desktops.webp", "MaxQ desktop multiplexer", "operator glass · desktops", 1037, 1200)}
        </section>
        <section>
          <h2>Persistence</h2>
          <p>MaxQ-owned state stays under <code>$HOME</code>. Apply, prove, status, and revert keep the state explicit.</p>
          ${shot("/shots/prove.webp", "maxq prove PASS on the Grok Bot computer", "persistence · prove PASS", 900, 562)}
        </section>
      </div>
    </section>

    <section class="how" id="how">
      <div class="how-copy">
        <p class="eyebrow">Lifecycle</p>
        <h2 class="display">Install. Operate. Prove or revert.</h2>
        <ol class="steps">
          <li><span class="step-num">01</span><div><h3>Install / apply</h3><p>The curl installer puts the MaxQ command in <code>$HOME/bin</code> and runs apply. Apply is idempotent.</p></div></li>
          <li><span class="step-num">02</span><div><h3>Operate</h3><p>The bot works on the configured workstation. You use loopback settings, processes, and desktops.</p></div></li>
          <li><span class="step-num">03</span><div><h3>Prove / revert</h3><p><code>maxq prove</code> runs revert → apply → assert and leaves APPLIED. <code>maxq revert</code> removes MaxQ-owned state.</p></div></li>
        </ol>
      </div>
      ${bezel("/shots/prove.webp", "maxq prove PASS on the Grok Bot computer", "prove · result=PASS · leaves APPLIED", "laptop", 900, 562)}
    </section>

    <section class="block" id="trust">
      <p class="eyebrow">Invariants</p>
      <h2 class="display">What MaxQ owns. What it refuses to own.</h2>
      <ul class="inv">
        <li>Persistent MaxQ state stays under <code>$HOME</code>.</li>
        <li>The control API binds loopback only at <code>127.0.0.1:7432</code> by default.</li>
        <li>GOST is optional; <code>enabled=false</code> and <code>intercept=false</code> by default.</li>
        <li>MaxQ does not write Chrome <code>ProxyMode</code> / <code>ProxyServer</code> managed policy.</li>
        <li><code>maxq revert</code> removes MaxQ-owned state. Revert is part of the product.</li>
      </ul>
    </section>

    <section class="surfaces" id="surfaces">
      <div class="section-head">
        <p class="eyebrow">Constellation context</p>
        <h2 class="display">Four surfaces. One stack.</h2>
        <p>MaxQ makes the box persist. Router spends seats. Cue and Crew are native control and chat surfaces.</p>
      </div>
      <div class="tabs" role="tablist">${tabs}</div>
      <div class="panels">${panels}</div>
    </section>

    <section class="block" id="start">
      <p class="eyebrow">Ready</p>
      <h2 class="display">Install MaxQ on the stock box.</h2>
      <p class="lede">Apply the workstation state. Keep the loopback side door. Prove or revert when you need to.</p>
      ${installLine()}
      <div class="cta-row">
        <a class="btn-solid" href="#install">Install</a>
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
