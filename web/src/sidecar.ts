/** #79 Sidecar Coming Soon — homepage SoT / anti-waterfall. Real GitHub crops only. */

const EXPLORE_MAXQ = "https://maxq.cxn.sh";
const SIDECAR_GITHUB = "https://github.com/OpenSecurity-Infosec/constellation-sidecar";

const proof = (src: string, alt: string, caption: string, w: number, h: number) => `
  <figure class="screen router-proof">
    <div class="screen-frame">
      <img src="${src}" alt="${alt}" width="${w}" height="${h}" loading="lazy" />
    </div>
    <figcaption>${caption}</figcaption>
  </figure>`;

export function renderSidecar(): string {
  return `
    <article class="block router-hero">
      <p class="coming-soon-badge" role="status">Coming Soon</p>
      <p class="eyebrow">MaxQ Sidecar</p>
      <h1>Your harness talks local. <span class="grad">Constellation answers upstream.</span></h1>
      <p class="lede">Sidecar is the OpenAI-compatible transport between local harnesses and Constellation Router. Work, Grok Build, OpenCode, and generic clients talk to Sidecar; Sidecar adapts request, tool, and stream shape to the selected catalog route and injects the upstream credential. <strong>Not a model host. Not the Router control plane.</strong></p>
      <p class="router-status">The operator-local binary runs today. Public Sidecar packaging is coming soon.</p>
      <div class="cta-row">
        <a class="btn-solid" href="${EXPLORE_MAXQ}">Explore MaxQ</a>
      </div>
    </article>

    <section class="router-proof-row" aria-label="Sidecar command entrypoints">
      ${proof(
        "/shots/sidecar-cmd-crop.webp",
        "GitHub constellation-sidecar cmd directory listing sidecar, infer, chatgpt-app-sidecar, and grok-build-sidecar",
        "cmd/ — four real entrypoints in the Sidecar repo",
        932,
        653,
      )}
    </section>

    <article class="block">
      <p class="eyebrow">Why Sidecar</p>
      <h2>Keep the harness. Share the catalog.</h2>
      <p class="lede">Operators already live in Work, Grok Build, OpenCode, or another OpenAI-compatible client. Sidecar is the local compatibility boundary so those harnesses can reach Constellation without each one holding gateway credentials or inventing its own protocol quirks.</p>
    </article>
    <div class="grid three router-why">
      <section>
        <h2>One local transport</h2>
        <p>Harnesses point at a loopback OpenAI-compatible server. Sidecar adapts and forwards.</p>
      </section>
      <section>
        <h2>Honest catalog</h2>
        <p>Clients see Constellation catalog IDs — not invented Sidecar model aliases.</p>
      </section>
      <section>
        <h2>Router stays control plane</h2>
        <p>Seats, routing, and telemetry remain on Router. Sidecar is transport only.</p>
      </section>
    </div>

    <section class="router-proof-row" aria-label="Sidecar protocol docs">
      ${proof(
        "/shots/sidecar-docs-crop.webp",
        "GitHub constellation-sidecar docs directory with Grok Build and harness adaptation documents",
        "docs/ — protocol and harness adaptation notes in-repo",
        932,
        653,
      )}
    </section>

    <article class="block">
      <p class="eyebrow">Grounded capabilities</p>
      <h2>What the operator-local binary already does.</h2>
    </article>
    <div class="grid three router-caps">
      <section>
        <h2>Same server as infer</h2>
        <p><code>sidecar</code>, <code>infer</code>, and <code>chatgpt-app-sidecar</code> run the same OpenAI-compatible server.</p>
      </section>
      <section>
        <h2>Harness adaptation</h2>
        <p>Generic OpenAI, Work, Grok Build, and OpenCode keep the protocol shape each expects.</p>
      </section>
      <section>
        <h2>Credential boundary</h2>
        <p>Clients auth locally; Sidecar injects the Constellation credential so it never lives in client config.</p>
      </section>
    </div>

    <article class="block coming-soon-boundary">
      <p class="coming-soon-badge coming-soon-badge--inline" role="status">Coming Soon</p>
      <p class="eyebrow">Public packaging is next</p>
      <h2>The local binary exists. Self-serve does not.</h2>
      <p class="lede">Sidecar already runs as the harness-facing transport, including a dedicated Grok Build lane. Public installer, doctor/diagnostics, compatibility matrix, and remaining stream reliability work are still landing. There is no Sidecar product GUI — evidence on this page is the real repo.</p>
      <div class="cta-row">
        <a class="btn-solid" href="${EXPLORE_MAXQ}">Explore MaxQ</a>
        <a class="btn-ghost" href="${SIDECAR_GITHUB}" target="_blank" rel="noopener noreferrer">Sidecar on GitHub</a>
      </div>
    </article>`;
}
