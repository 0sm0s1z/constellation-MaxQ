/** #80 Track B — Router Coming Soon (homepage SoT). Real cropped stills only. */

const EXPLORE_MAXQ = "https://maxq.cxn.sh";
const ROUTER_GITHUB = "https://github.com/OpenSecurity-Infosec/constellation-router";

const proof = (src: string, alt: string, caption: string, w: number, h: number) => `
  <figure class="screen router-proof">
    <div class="screen-frame">
      <img src="${src}" alt="${alt}" width="${w}" height="${h}" loading="lazy" />
    </div>
    <figcaption>${caption}</figcaption>
  </figure>`;

export function renderRouter(): string {
  return `
    <article class="block router-hero">
      <p class="coming-soon-badge" role="status">Coming Soon</p>
      <p class="eyebrow">MaxQ Router</p>
      <h1>One route for the <span class="grad">seats you already pay for.</span></h1>
      <p class="lede">Constellation Router turns paid AI coding and model subscriptions into one governed OpenAI-compatible path. Connect the seats you already use, see usable capacity, and give compatible clients one honest catalog of what those seats can run. It routes subscriptions — it does not host models.</p>
      <p class="router-status">The gateway is live. Public Router packaging is coming soon.</p>
      <div class="cta-row">
        <a class="btn-solid" href="${EXPLORE_MAXQ}">Explore MaxQ</a>
      </div>
    </article>

    <section class="router-proof-row" aria-label="Router product proof">
      ${proof(
        "/shots/router-seats-crop.webp",
        "Constellation Router seats panel showing linked subscription seats and online status",
        "Connected seats — linked subscriptions in one operator view",
        998,
        324,
      )}
    </section>

    <article class="block">
      <p class="eyebrow">Why Router</p>
      <h2>Keep the route simple.</h2>
      <p class="lede">See the useful path, not the machinery behind it. Router brings connection and routing signals into one focused experience so operators stop wiring every client to every subscription by hand.</p>
    </article>
    <div class="grid three router-why">
      <section>
        <h2>One catalog</h2>
        <p>Compatible clients get one place to call the seats you already pay for.</p>
      </section>
      <section>
        <h2>Capacity in view</h2>
        <p>Remaining quota and seat state stay visible so routing stays intentional.</p>
      </section>
      <section>
        <h2>Honest limits</h2>
        <p>The catalog advertises only what connected adapters actually support.</p>
      </section>
    </div>

    <section class="router-proof-row" aria-label="Router routing proof">
      ${proof(
        "/shots/router-dashboard-crop.webp",
        "Constellation Router dashboard showing throughput metrics and seat link status",
        "Routing view — throughput and seat signal at a glance",
        998,
        484,
      )}
    </section>

    <article class="block">
      <p class="eyebrow">Grounded capabilities</p>
      <h2>What the product already shows.</h2>
    </article>
    <div class="grid three router-caps">
      <section>
        <h2>Connected seats</h2>
        <p>Codex, SuperGrok, Claude Code, Cursor, and custom seats in one pool.</p>
      </section>
      <section>
        <h2>Routing view</h2>
        <p>Operator surfaces for capacity, connection state, and route evidence.</p>
      </section>
      <section>
        <h2>Operational signal</h2>
        <p>Online status and linked-seat counts stay on the sell surface — not a telemetry wall.</p>
      </section>
    </div>

    <article class="block coming-soon-boundary">
      <p class="coming-soon-badge coming-soon-badge--inline" role="status">Coming Soon</p>
      <p class="eyebrow">Public packaging is next</p>
      <h2>The gateway is running today.</h2>
      <p class="lede">We are shaping the public package and onboarding before opening Router broadly. This page is a product preview — not an install prompt.</p>
      <div class="cta-row">
        <a class="btn-solid" href="${EXPLORE_MAXQ}">Explore MaxQ</a>
        <a class="btn-ghost" href="${ROUTER_GITHUB}" target="_blank" rel="noopener noreferrer">Router on GitHub</a>
      </div>
    </article>`;
}
