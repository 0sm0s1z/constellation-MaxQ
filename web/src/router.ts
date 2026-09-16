const ROUTER_GITHUB = "https://github.com/OpenSecurity-Infosec/constellation-router";

const routerScreen = (
  src: string,
  alt: string,
  caption: string,
  wide = false,
) => `
  <figure class="screen router-screen${wide ? " router-screen--wide" : ""}">
    <div class="screen-frame">
      <img src="${src}" alt="${alt}" width="1280" height="800" loading="lazy" />
    </div>
    <figcaption>${caption}</figcaption>
  </figure>`;

export function renderRouter(): string {
  return `
    <article class="block router-hero">
      <p class="coming-soon-badge" role="status">Coming Soon</p>
      <p class="eyebrow">01 · Router</p>
      <h1>One API for the <span class="grad">seats you already pay for.</span></h1>
      <p class="lede">Constellation Router turns paid AI coding and model subscriptions into one governed OpenAI-compatible routing surface. Connect the seats you already use, see usable capacity, and give compatible clients one catalog of what those seats can actually run. It routes subscriptions; it does not host models.</p>
      <div class="cta-row">
        <a class="btn-solid" href="${ROUTER_GITHUB}" target="_blank" rel="noopener noreferrer">Router on GitHub</a>
      </div>
    </article>

    <article class="block router-purpose">
      <p class="eyebrow">Purpose</p>
      <h2>Make paid seats work like one pool.</h2>
      <p class="lede">Router is for operators already paying for several providers. Instead of wiring each client to each subscription separately, it gives compatible tools one catalog and one routing layer while keeping provider limits and remaining capacity visible.</p>
    </article>

    <section class="router-showcase" aria-label="Fresh Router product captures">
      ${routerScreen(
        "/shots/router-seats-fresh.webp",
        "Constellation Router seats view showing linked provider seats",
        "real capture · Seats · linked subscriptions and seat state",
        true,
      )}
      <div class="router-shot-pair">
        ${routerScreen(
          "/shots/router-dashboard-fresh.webp",
          "Constellation Router dashboard showing routing and quota information",
          "real capture · Dashboard · routing and capacity",
        )}
        ${routerScreen(
          "/shots/router-connect-fresh.webp",
          "Constellation Router connect view showing provider connection options",
          "real capture · Connect · provider connection workflow",
        )}
      </div>
    </section>

    <article class="block">
      <p class="eyebrow">What it does</p>
      <h2>A small control surface for a messy subscription stack.</h2>
    </article>
    <div class="grid two router-points">
      <section>
        <h2>Connect paid seats</h2>
        <p>Bring Codex, SuperGrok, Claude Code, Cursor, and custom seats into one operator view.</p>
      </section>
      <section>
        <h2>Route by usable capacity</h2>
        <p>Constellation Auto can weigh remaining quota, reset timing, and task fit, or you can pin a named model when you want deterministic selection.</p>
      </section>
      <section>
        <h2>Keep the catalog honest</h2>
        <p>Clients see only models and capabilities the connected adapters actually support—no invented provider features.</p>
      </section>
      <section>
        <h2>See the pool</h2>
        <p>Seats, capacity, connection state, and routing evidence stay visible so the gateway can be operated instead of treated like a black box.</p>
      </section>
    </div>

    <article class="block router-who">
      <p class="eyebrow">Who it is for</p>
      <h2>Operators with several AI subscriptions and several clients.</h2>
      <p class="lede">If you already pay for multiple seats and want OpenCode, ChatGPT Work, or another OpenAI-compatible client to share one governed pool instead of maintaining a separate setup for every subscription, Router is the layer between them.</p>
    </article>

    <article class="block coming-soon-boundary">
      <p class="eyebrow">Coming Soon</p>
      <h2>Working internally. Not public self-serve yet.</h2>
      <p class="lede">The gateway and operator surfaces are already running internally. Public packaging, production hardening, and some provider capabilities are still landing. Until that work is complete, this page is a product preview—not a buy or install prompt.</p>
      <div class="cta-row">
        <a class="btn-ghost" href="${ROUTER_GITHUB}" target="_blank" rel="noopener noreferrer">Follow Router on GitHub</a>
      </div>
    </article>`;
}
