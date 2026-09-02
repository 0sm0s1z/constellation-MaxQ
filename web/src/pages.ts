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

export function renderHome(): string {
  return `
    <section class="hero">
      <div class="hero-copy">
        <h1>Take your Grok Bot to ${nameLogo("hero-logo")}.</h1>
        <p class="lede">A persist-safe agent workstation. Mocha on the glass. Loopback for control. Revert does not delete the machine.</p>
        ${installLine()}
        <p class="cta-row"><a class="btn-gh" href="${GITHUB}">github</a></p>
        <ul class="chips"><li>state=applied</li><li>intercept=false</li><li>$HOME only</li><li>prove PASS</li></ul>
      </div>
      <div class="hero-visual">
        <img class="hero-laptop" src="/shots/maxq-desktop.webp" alt="MaxQ mocha workstation on grokbot" width="1100" height="687" />
      </div>
    </section>
    <div class="strip">
      ${shot("/shots/settings.webp", "MaxQ settings, Ghostty 1.3.1, rofi, applied", "settings · applied", 1000, 624)}
      ${shot("/shots/rofi.webp", "Rofi Super+Space launcher with PNG brand icons", "launcher · Super+Space", 1000, 625)}
      ${shot("/shots/ghostty.webp", "Ghostty 1.3.1 mocha terminal on grokbot", "ghostty · 1.3.1", 1100, 687)}
      ${shot("/shots/prove.webp", "maxq prove PASS on grokbot", "prove · PASS", 900, 562)}
    </div>
    <div class="products">
      <a class="pcard" href="#router"><h2>router</h2><p>Every seat you already pay for. Hard jobs, cheap tokens, reset clocks.</p><img src="/shots/router-dashboard.webp" alt="Constellation Router dashboard" width="1100" height="535" /></a>
      <a class="pcard" href="#crew"><h2>crew</h2><p>Apple-native steer. Pluggable computers.</p><img src="/shots/crew-macos.webp" alt="Crew multiplexer on macOS" width="1006" height="670" /></a>
      <a class="pcard" href="#cue"><h2>cue</h2><p>SwiftUI chat-and-steer. Not an Electron fork.</p><img src="/shots/cue-macos.webp" alt="Cue chat-and-steer on macOS" width="1006" height="670" /></a>
      <a class="pcard" href="#stack"><h2>stack</h2><p>Four surfaces. One constellation.</p><img src="/shots/maxq-desktop.webp" alt="MaxQ desktop" width="1100" height="687" /></a>
    </div>
    <div class="grid three">
      <section><h2>persist</h2><p>Only <code>$HOME</code> — bin, .config/maxq, .local. Revert does not delete the machine.</p></section>
      <section><h2>theme</h2><p>Mocha wallpaper, GTK, Ghostty, unpacked Chrome theme, plank, rofi.</p></section>
      <section><h2>control</h2><p>maxq-api on 127.0.0.1:7432. Apply, revert, proxy.</p></section>
    </div>`;
}

export function renderStack(): string {
  return `
    <article class="block">
      <h1>One constellation. <span class="grad">Four surfaces.</span></h1>
      <p class="lede">Router spends the seats. MaxQ makes the box persist. Cue and Crew are the native glass.</p>
    </article>
    <div class="device-row">
      ${bezel("/shots/router-dashboard.webp", "Constellation Router dashboard", "router · seats", "laptop", 1100, 535)}
      ${bezel("/shots/settings.webp", "MaxQ settings applied", "maxq · settings", "laptop", 1000, 624)}
      ${bezel("/shots/cue-macos.webp", "Cue chat-and-steer on macOS", "cue · macOS", "laptop", 1006, 670)}
    </div>
    <div class="products">
      <a class="pcard" href="#router"><h2>router</h2><p>Constellation Auto. Hardness, remaining tokens, time-to-reset.</p></a>
      <a class="pcard" href="#home"><h2>maxq</h2><p>Persist-safe Grok Bot computer. $HOME only. Loopback.</p></a>
      <a class="pcard" href="#cue"><h2>cue</h2><p>SwiftUI chat-and-steer. Native macOS.</p></a>
      <a class="pcard" href="#crew"><h2>crew</h2><p>Cue pattern plus ComputerProviders: Docker, VZ, Proxmox, Connect-Mac.</p></a>
    </div>`;
}

export function renderRouter(): string {
  return `
    <article class="block">
      <h1>Make every <span class="grad">seat</span> count.</h1>
      <p class="lede">Constellation Auto picks a model from seats you already pay for: how hard the job is, the cheapest remaining token, and how close that seat is to reset.</p>
    </article>
    ${bezel("/shots/router-dashboard.webp", "Constellation Router dashboard: seats, included usage, reset clocks", "operations · dashboard", "laptop", 1100, 535)}
    <div class="grid three">
      <section><h2>hard jobs</h2><p>Spend the expensive seat when the work is actually hard.</p></section>
      <section><h2>cheap remainder</h2><p>Mid-cycle, hoard Sol. Burn Luna or Grok on routine work.</p></section>
      <section><h2>reset clock</h2><p>Near reset, spend tokens that are about to vanish.</p></section>
    </div>
    ${shot("/shots/router-seats.webp", "Constellation Router seats table", "seats · linked", 900, 420)}`;
}

export function renderCue(): string {
  return `
    <article class="block">
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
      <h1><span class="grad">Crew</span> steers computers.</h1>
      <p class="lede">Cue-like SwiftUI with pluggable ComputerProviders: local Docker/VZ, Proxmox, AWS/EC2, Connect-Mac. Chat stays in Crew. The box is a provider.</p>
    </article>
    <div class="device-row one">
      ${bezel("/shots/crew-macos.webp", "Crew multiplexer on macOS: Assigns computers", "crew · macOS multiplexer", "laptop", 1006, 670)}
    </div>`;
}

export function renderInstall(): string {
  return `
    <article class="block"><h2>from stock</h2><p class="lede">The installer copies <code>maxq</code> into <code>$HOME/bin</code> and runs apply. Apply is idempotent. Prove runs revert → apply → assert and leaves APPLIED.</p>${installLine()}</article>
    ${shot("/shots/prove.webp", "maxq prove PASS on grokbot", "maxq prove · result=PASS · intercept=false", 900, 562)}
    ${shot("/shots/rofi.webp", "Rofi Super+Space", "launcher · Super+Space", 1000, 625)}
    <article class="block"><h2>commands</h2><table class="cli"><thead><tr><th>command</th><th>does</th></tr></thead><tbody>
      <tr><td>maxq status</td><td class="dim">applied | reverted</td></tr>
      <tr><td>maxq apply</td><td class="dim">configure (idempotent)</td></tr>
      <tr><td>maxq revert</td><td class="dim">unconfigure MaxQ-owned files only</td></tr>
      <tr><td>maxq prove</td><td class="dim">revert/apply/assert cycle; leaves APPLIED</td></tr>
      <tr><td>maxq proxy</td><td class="dim">GOST settings (local process only)</td></tr>
    </tbody></table></article>`;
}

export function renderInvariants(): string {
  return `
    <article class="block"><h2>the box can come apart</h2><p class="lede">MaxQ is the load line, not a hostage-taking dotfile run. Revert is part of the product.</p>
    <ul class="inv">
      <li>Persist only under $HOME — bin, .config/maxq, .local</li>
      <li>Never write Chrome ProxyMode / ProxyServer / managed policy</li>
      <li>GOST intercept defaults false</li>
      <li>Revert does not delete $HOME, SSH keys, Chrome profiles, or the persist CA</li>
      <li>API refuses non-loopback binds</li>
    </ul></article>
    ${shot("/shots/plank.webp", "Plank dock with ChatGPT Claude Grok Slack Discord Ghostty", "dock · mocha icons", 900, 562)}
    ${shot("/shots/chrome-mocha.webp", "Chrome mocha toolbar", "chrome · mocha", 900, 562)}`;
}

export function renderOps(): string {
  return `
    <article class="block"><h2>control API</h2><p class="lede">Go stdlib + embedded mocha sheet. apply starts it. revert stops it. No auth beyond localhost.</p>
    ${bezel("/shots/settings.webp", "MaxQ settings Defaults", "GET / · applied · Ghostty 1.3.1", "laptop", 1000, 624)}
    <table class="cli"><thead><tr><th>route</th><th>notes</th></tr></thead><tbody>
      <tr><td>GET /</td><td class="dim">thin settings sheet</td></tr>
      <tr><td>GET /status</td><td class="dim">applied, theme, gost, clis</td></tr>
      <tr><td>POST /apply</td><td class="dim">runs maxq apply</td></tr>
      <tr><td>POST /revert</td><td class="dim">200 then the process exits</td></tr>
    </tbody></table></article>`;
}
