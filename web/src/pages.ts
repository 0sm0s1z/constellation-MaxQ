export type Route = "home" | "install" | "invariants" | "ops";

export const INSTALL =
  "curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash";

export function parseRoute(): Route {
  const hash = (location.hash || "#home").replace("#", "");
  if (hash === "install" || hash === "invariants" || hash === "ops") return hash;
  return "home";
}

const win = (title: string, body: string, meta = "tty1") => `
  <section class="window">
    <div class="titlebar">
      <span class="traffic" aria-hidden="true"><i class="c"></i><i class="y"></i><i class="g"></i></span>
      <span class="name">${title}</span>
      <span class="meta">${meta}</span>
    </div>
    <div class="pane">${body}</div>
  </section>`;

export function renderHome(): string {
  return `
    ${win(
      "maxq — session",
      `
      <div class="hero">
        <img class="mark" src="/mark.svg" alt="MaxQ orbital Q" />
        <div>
          <h1>Take your Grok Bot to MaxQ.</h1>
          <p class="lede">One command turns a stock computer into a persist-safe agent workstation. Theme is Catppuccin Mocha. Control plane is loopback. Revert does not delete the machine.<span class="cursor"></span></p>
          <div class="term">
            <code><span class="ps1">$</span> <span class="cmd">${INSTALL}</span></code>
            <button class="copy" type="button" data-copy="${INSTALL}">copy</button>
          </div>
          <div class="pills">
            <span class="pill on">state=applied</span>
            <span class="pill">theme=mocha</span>
            <span class="pill">api=127.0.0.1:7432</span>
            <span class="pill warn">intercept=false</span>
          </div>
        </div>
      </div>`,
      "v0.5.0",
    )}
    <div class="grid">
      ${win("persist", "<h2>under $HOME</h2><p>bin, .config/maxq, .local only. No /usr. No sudo. Profile hooks are marked blocks that revert can strip.</p>")}
      ${win("theme", "<h2>mocha constellation</h2><p>Wallpaper, GTK, cursors, Ghostty config, unpacked Chrome theme. Chrome is not live-applied. Ghostty is config-only.</p>")}
      ${win("control", "<h2>loopback sheet</h2><p>maxq-api binds 127.0.0.1:7432. Apply / revert / proxy. Vault, OAuth, and skills stay placeholders until the settings pages land.</p>")}
    </div>`;
}

export function renderInstall(): string {
  return `
    ${win(
      "install.sh",
      `
      <h2>from stock</h2>
      <p class="lede">The installer copies <code>maxq</code> into <code>$HOME/bin</code> and runs apply. Apply is idempotent. Prove runs revert → apply → assert and leaves APPLIED.</p>
      <div class="term">
        <code><span class="ps1">$</span> <span class="cmd">${INSTALL}</span></code>
        <button class="copy" type="button" data-copy="${INSTALL}">copy</button>
      </div>`,
    )}
    ${win(
      "maxq --help",
      `
      <table class="cli">
        <thead><tr><th>command</th><th>does</th></tr></thead>
        <tbody>
          <tr><td>maxq status</td><td class="dim">applied | reverted</td></tr>
          <tr><td>maxq apply</td><td class="dim">configure (idempotent)</td></tr>
          <tr><td>maxq revert</td><td class="dim">unconfigure MaxQ-owned files only</td></tr>
          <tr><td>maxq prove</td><td class="dim">revert/apply/assert cycle; leaves APPLIED</td></tr>
          <tr><td>maxq proxy</td><td class="dim">GOST settings (local process only)</td></tr>
          <tr><td>maxq proxy on|off</td><td class="dim">start/stop gost; no Chrome ProxyMode</td></tr>
          <tr><td>maxq proxy upstream &lt;url&gt;</td><td class="dim">optional hop</td></tr>
          <tr><td>maxq proxy iface &lt;name&gt;</td><td class="dim">outbound interface / tunnel</td></tr>
        </tbody>
      </table>`,
    )}
    ${win(
      "clis.txt",
      `
      <h2>operator tools</h2>
      <p class="lede">Apply installs official linux amd64 binaries into <code>$HOME/bin</code> when they exist. Missing tools are skipped, not fatal.</p>
      <table class="cli">
        <thead><tr><th>bin</th><th>source</th></tr></thead>
        <tbody>
          <tr><td>herdr</td><td class="dim">herdrdev/herdr</td></tr>
          <tr><td>fx</td><td class="dim">vercel-labs/fx</td></tr>
          <tr><td>grok</td><td class="dim">x.ai/cli</td></tr>
          <tr><td>codex</td><td class="dim">openai/codex</td></tr>
          <tr><td>claude</td><td class="dim">downloads.claude.ai</td></tr>
          <tr><td>opencode</td><td class="dim">from-scratch install tracked in issue #2</td></tr>
          <tr><td>tailscale</td><td class="dim">from-scratch install tracked in issue #2</td></tr>
        </tbody>
      </table>`,
    )}`;
}

export function renderInvariants(): string {
  return `
    ${win(
      "TRUST.md",
      `
      <h2>the box can come apart</h2>
      <p class="lede">MaxQ is the load line, not a hostage-taking dotfile run. Revert is part of the product.</p>
      <ul class="inv">
        <li>Persist only under $HOME — bin, .config/maxq, .local</li>
        <li>Never write Chrome ProxyMode / ProxyServer / managed policy</li>
        <li>GOST intercept defaults false. CA is not auto-trusted into /usr or Chrome</li>
        <li>Revert does not delete $HOME, SSH keys, Chrome profiles, or the persist CA</li>
        <li>MaxQ-owned CLIs are marked and removed; preexisting binaries stay</li>
        <li>API refuses non-loopback binds</li>
        <li>Ghostty is config-only — no unofficial AppImage</li>
        <li>Chrome theme is unpacked files plus store id, not live-applied</li>
      </ul>`,
    )}
    <div class="two">
      ${win("gost.yml", "<h2>proxy</h2><p>Local CONNECT on 127.0.0.1:8080. Upstream and iface are optional. MITM stays off until you opt in and trust the persist CA yourself.</p>")}
      ${win("maxq.toml", "<h2>desired state</h2><p>theme = mocha. latte is a future flag only. state, gost, clis, and api listen live in one file apply can rewrite.</p>")}
    </div>`;
}

export function renderOps(): string {
  return `
    ${win(
      "127.0.0.1:7432",
      `
      <h2>control API</h2>
      <p class="lede">Go stdlib + embedded Mocha sheet. apply starts it. revert stops it. No auth beyond localhost.</p>
      <table class="cli">
        <thead><tr><th>route</th><th>notes</th></tr></thead>
        <tbody>
          <tr><td>GET /</td><td class="dim">thin settings sheet</td></tr>
          <tr><td>GET /status</td><td class="dim">applied, theme, gost, clis</td></tr>
          <tr><td>POST /apply</td><td class="dim">runs maxq apply</td></tr>
          <tr><td>POST /revert</td><td class="dim">200 then the process exits</td></tr>
          <tr><td>POST /proxy</td><td class="dim">{enabled, upstream, iface} — process only</td></tr>
        </tbody>
      </table>`,
    )}
    ${win(
      "PLAN.md",
      `
      <dl class="kv">
        <dt>shipped</dt><dd>persist, installer, reconciler, mocha theme, CLIs, GOST, CA, loopback API, sheet</dd>
        <dt>next</dt><dd>OpenCode + Tailscale from scratch (#2), herdr supervise, operator hop, vault, OAuth seating, triggers</dd>
        <dt>host</dt><dd>linux amd64 · $HOME only · pidfile, not systemd</dd>
        <dt>source</dt><dd>github.com/0sm0s1z/constellation-MaxQ</dd>
      </dl>`,
    )}`;
}
