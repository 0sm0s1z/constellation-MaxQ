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
    title: "Persist-safe. Revert is part of the product.",
    lede: "Only $HOME. Mocha on the glass. Loopback for control. Revert does not delete the machine.",
    src: "/shots/settings.webp",
    alt: "MaxQ settings sheet, theme mocha, state applied",
    cap: "maxq · settings applied",
    w: 1000,
    h: 624,
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
    alt: "Crew multiplexer on macOS: Assigns computers",
    cap: "crew · macOS multiplexer",
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
        <p class="eyebrow">Persist-safe Grok Bot computer</p>
        <h1>Take your Grok Bot to ${nameLogo("hero-logo")}.</h1>
        <p class="lede">Mocha on the glass. Loopback for control. Revert does not delete the machine.</p>
        <div class="cta-row">
          <a class="btn-solid" href="#install">Install</a>
          <a class="btn-ghost" href="#how">See how it works</a>
        </div>
        ${installLine()}
      </div>
      <div class="hero-visual">
        ${bezel("/shots/maxq-desktop.webp", "MaxQ mocha workstation on grokbot", "maxq · ghostty 1.3.1", "laptop", 1100, 687)}
      </div>
    </section>
    <div class="proof">
      <span>state=applied</span>
      <span>intercept=false</span>
      <span>$HOME only</span>
      <span>prove PASS</span>
    </div>
    <section class="how" id="how">
      <div class="how-copy">
        <p class="eyebrow">How it works</p>
        <h2 class="display">One box. Four simple steps.</h2>
        <ol class="steps">
          <li><span class="step-num">01</span><div><h3>Persist</h3><p>Only <code>$HOME</code> — bin, .config/maxq, .local. Revert does not delete the machine.</p></div></li>
          <li><span class="step-num">02</span><div><h3>Glass</h3><p>Mocha wallpaper, GTK, Ghostty, unpacked Chrome theme, plank, rofi.</p></div></li>
          <li><span class="step-num">03</span><div><h3>Loopback</h3><p>maxq-api on 127.0.0.1:7432. Apply, revert, proxy. Non-loopback binds are refused.</p></div></li>
          <li><span class="step-num">04</span><div><h3>Prove</h3><p>Revert → apply → assert. Leaves APPLIED. Intercept stays false.</p></div></li>
        </ol>
      </div>
      ${bezel("/shots/settings.webp", "MaxQ settings sheet, theme mocha, state applied", "settings · applied", "laptop", 1000, 624)}
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
      ${bezel("/shots/cue-macos.webp", "Cue macOS: Messages, MuxBot chat, Multiplexer assigns computers", "cue · macOS", "laptop", 1006, 670)}
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
      ${bezel("/shots/crew-macos.webp", "Crew multiplexer on macOS: Assigns computers", "crew · macOS multiplexer", "laptop", 1006, 670)}
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
