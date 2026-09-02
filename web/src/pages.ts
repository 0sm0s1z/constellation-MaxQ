export type Route = "home" | "install" | "invariants" | "ops";

export const INSTALL =
  "curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash";

export function parseRoute(): Route {
  const hash = (location.hash || "#home").replace("#", "");
  if (hash === "install" || hash === "invariants" || hash === "ops") return hash;
  return "home";
}

const installLine = () => `
  <div class="term">
    <code><span class="ps1">$</span><span class="cmd">${INSTALL}</span><span class="cursor"></span></code>
    <button class="copy" type="button" data-copy="${INSTALL}">copy</button>
  </div>`;

export function renderHome(): string {
  return `
    <header class="hero">
      <h1>Take your Grok Bot to MaxQ.</h1>
      <p class="lede">One command turns a stock computer into a persist-safe agent workstation. Mocha on the glass. Loopback for control. Revert does not delete the machine.</p>
      ${installLine()}
      <p class="meta"><b>state=applied</b> · theme=mocha · api=127.0.0.1:7432 · <span class="warn">intercept=false</span></p>
    </header>
    <div class="grid three">
      <section>
        <h2>persist</h2>
        <p>Only <code>$HOME</code> — bin, .config/maxq, .local. No /usr. No sudo. Profile hooks are marked blocks revert can strip.</p>
      </section>
      <section>
        <h2>theme</h2>
        <p>Wallpaper, GTK, cursors, Ghostty config, unpacked Chrome theme. Chrome is not live-applied. Ghostty is config-only.</p>
      </section>
      <section>
        <h2>control</h2>
        <p>maxq-api binds 127.0.0.1:7432. Apply, revert, proxy. Vault, OAuth, and skills stay placeholders.</p>
      </section>
    </div>`;
}

export function renderInstall(): string {
  return `
    <article class="block">
      <h2>from stock</h2>
      <p class="lede">The installer copies <code>maxq</code> into <code>$HOME/bin</code> and runs apply. Apply is idempotent. Prove runs revert → apply → assert and leaves APPLIED.</p>
      ${installLine()}
    </article>
    <article class="block">
      <h2>commands</h2>
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
      </table>
    </article>
    <article class="block">
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
      </table>
    </article>`;
}

export function renderInvariants(): string {
  return `
    <article class="block">
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
      </ul>
    </article>
    <div class="grid two">
      <section>
        <h2>proxy</h2>
        <p>Local CONNECT on 127.0.0.1:8080. Upstream and iface are optional. MITM stays off until you opt in and trust the persist CA yourself.</p>
      </section>
      <section>
        <h2>desired state</h2>
        <p>theme = mocha. latte is a future flag only. state, gost, clis, and api listen live in one file apply can rewrite.</p>
      </section>
    </div>`;
}

export function renderOps(): string {
  return `
    <article class="block">
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
      </table>
    </article>
    <article class="block">
      <h2>plan</h2>
      <dl class="kv">
        <dt>shipped</dt><dd>persist, installer, reconciler, mocha theme, CLIs, GOST, CA, loopback API, sheet</dd>
        <dt>next</dt><dd>OpenCode + Tailscale from scratch (#2), herdr supervise, operator hop, vault, OAuth seating, triggers</dd>
        <dt>host</dt><dd>linux amd64 · $HOME only · pidfile, not systemd</dd>
        <dt>source</dt><dd>github.com/0sm0s1z/constellation-MaxQ</dd>
      </dl>
    </article>`;
}
