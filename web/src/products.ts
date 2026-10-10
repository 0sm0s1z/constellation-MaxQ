type Product = {
  id: string; name: string; tint: string; category: string; title: string; intro: string;
  image: string; alt: string; caption: string; focus: string; detail: string;
  steps: [string, string][]; boundary: string; availability: string;
};

const products: Record<string, Product> = {
  cue: {
    id: "cue", name: "Cue", tint: "mauve", category: "Capture · annotate · compose",
    title: "Show exactly<br>what you mean.",
    intro: "A screenshot is a starting point. Cue turns captures into clear, editable evidence — framed, annotated, and ready for the next person or model. Native on macOS.",
    image: "/shots/cue-macos.webp", alt: "Cue editor with the MaxQ launch composition, layer inspector and timeline",
    caption: "Made with Cue · the MaxQ launch composition in the macOS editor.",
    focus: "The canvas is the conversation.", detail: "Capture a region, window, or display. Bring it onto one canvas. Point to what matters, hide what does not, and keep the composition editable. The launch on this site was exported from Cue.",
    steps: [["Capture the context", "Region, window, display, or imported media. Start with what is actually on the screen."], ["Make the point", "Arrows, steps, text, highlights, blur, and redaction. Arrange stills or trim a clip without losing the source."], ["Hand it off", "Copy a flattened PNG, export video or GIF, or save an editable .cue package. The recipient gets the evidence, not another explanation to decode."]],
    boundary: "The macOS capture-and-compose loop exists today. capturectl exposes typed actions for automation; the in-app assistant covers a smaller set of tools. This is not a promise of full computer-use automation or an iOS release.",
    availability: "Cue for macOS is coming soon. Public download and signup are not open here.",
  },
  crew: {
    id: "crew", name: "Crew", tint: "peach", category: "Projects · agents · execution",
    title: "Give the work<br>a workspace.",
    intro: "A native development workspace for you and your agents. Bring a project, set an objective, and keep the work, execution and results together. Prime coordinates the next step; you can inspect, steer and stop the run.",
    image: "/shots/crew-macos.webp", alt: "Earlier Crew macOS development build with a conversation and experimental execution panel",
    caption: "Earlier development capture · the project workspace and native terminal are evolving.",
    focus: "The project holds the context.", detail: "Crew is being built around the development project: its repository, tasks, agent runs and retained results. The model and the computer are separate choices. Conversation carries the objective and your steering, while the workspace keeps the work in view.",
    steps: [["Open the project", "Keep repository context and work history together. Explicitly choose the agent and execution environment for the task."], ["Let Prime drive", "Prime is the workspace Driver: observe, plan, delegate, monitor and validate. Worker completion needs evidence tied to the objective, with bounded follow-up when a report is missing."], ["Stay in control", "Inspect sessions and terminal activity, steer or stop the run, and retain its results. Approvals, human control and safe recovery are being developed around explicit ownership and verified outcomes."]],
    boundary: "Crew is in active development on macOS. Current work connects explicitly selected Herdr sessions and builds native terminal, evidence-gated execution and protected recovery. The Cua MVP targets an isolated Linux Space with terminal, files and desktop interaction. End-to-end Cua acceptance, native terminal control and recovery verification remain in progress.",
    availability: "Crew for macOS is coming soon. Public download and onboarding are not open yet.",
  },
  router: {
    id: "router", name: "Router", tint: "sky", category: "Capacity · reset clocks · route decisions",
    title: "Know what is left.<br>Know where it goes.",
    intro: "Put the seats you already pay for in view. Constellation Router brings supported subscription capacity, reset clocks, and routing decisions together — with an OpenAI-compatible path for compatible clients.",
    image: "/shots/router-dashboard-crop.webp", alt: "Captured Router dashboard with throughput metrics and linked seat state",
    caption: "Operator dashboard capture · observed seat and throughput signals, not a live demo.",
    focus: "A limit is easier to work with when you can see it.", detail: "A connected seat is not unlimited capacity. Router makes quota signals and reset timing visible where available, and keeps route evidence close to the operator. Unknown capacity stays unknown.",
    steps: [["Connect the seats", "Bring supported subscriptions into one catalog. Available models depend on the connected adapter and execution path."], ["Read the capacity", "See seat state, available quota signals, and reset timing. Not every provider exposes a remaining-token meter."], ["Inspect the decision", "The web routing layer records recent served-turn decisions and reasons. See what was selected without treating the transcript as telemetry."]],
    boundary: "Web Auto weighs task fit, capacity, and reset timing. The Go cxn-router execution server does not yet implement that Auto engine; constellation/auto fails closed there. Do not assume that selecting Auto in one surface enables it in every client. Router routes requests; it does not host models.",
    availability: "Router public packaging is coming soon. Operator deployments exist; self-serve onboarding and signup are not open here.",
  },
};

const media = (p: Product) => `<figure class="product-media ${p.id}-media"><a href="${p.image}" target="_blank" rel="noopener noreferrer" aria-label="Open full ${p.name} screenshot in a new tab"><div class="product-crop"><img src="${p.image}" alt="${p.alt}" /></div></a><figcaption><span>${p.caption}</span><a href="${p.image}" target="_blank" rel="noopener noreferrer">View full capture ↗</a></figcaption></figure>`;

export function renderProduct(id: "cue" | "crew" | "router"): string {
  const p = products[id];
  return `<article class="product-page" style="--product-accent:var(--${p.tint})">
    <header class="product-hero">
      <div><a class="product-back" href="#stack">Constellation / ${p.name}</a><p class="eyebrow">${p.category}</p><h1>${p.title}</h1></div>
      <div class="product-intro"><span class="product-status">${p.name} · Coming soon</span><p class="lede">${p.intro}</p><a class="btn-solid" href="#${p.id}-availability" data-section="${p.id}-availability">${p.name} availability ↓</a></div>
    </header>
    ${media(p)}
    <section class="product-story"><p class="eyebrow">The job</p><div><h2>${p.focus}</h2><p class="lede">${p.detail}</p></div></section>
    <ol class="product-workflow">${p.steps.map(([title, body], i) => `<li><span class="product-step">0${i + 1}</span><h3>${title}</h3><p>${body}</p></li>`).join("")}</ol>
    ${id === "router" ? `<figure class="product-media"><img src="/shots/router-seats-crop.webp" alt="Router linked seats table with provider and connection state" loading="lazy" /><figcaption>Connected seats capture · connection state is not a guarantee of remaining quota.</figcaption></figure>` : ""}
    <section class="product-boundary"><p class="eyebrow">${id === "crew" ? "Development status" : "What exists. What does not."}</p><h2>${id === "router" ? "One name. Distinct execution paths." : "A clear line around the preview."}</h2><p>${p.boundary}</p></section>
    <section class="product-availability" id="${p.id}-availability"><div><p class="eyebrow">${p.name} · availability</p><h2>${id === "cue" ? "Better evidence starts here." : id === "crew" ? "Keep the project. Carry the work forward." : "Make the next route an informed one."}</h2><p>${p.availability}</p></div><div class="product-next"><a class="btn-ghost" href="#stack">Explore the stack →</a><a href="#home">Meet MaxQ, the bot's workstation</a><small>The Get MaxQ form is for MaxQ only.</small></div></section>
  </article>`;
}

export function renderProductStack(): string {
  return `<article class="product-page stack-page"><header class="product-hero"><div><p class="eyebrow">Constellation · product map</p><h1>Different jobs.<br>Shared intent.</h1></div><div class="product-intro"><p class="lede">Prepare the evidence. Develop the project. See the capacity. Tailor the computer. Choose the surface for the job — this is a product family, not a promise that every integration ships today.</p><a class="btn-solid" href="#home">Start with MaxQ →</a></div></header>
    <div class="stack-grid"><a class="stack-card" href="#home"><span class="product-status">MaxQ · Available to install</span><h2>The bot's workstation.</h2><p>A co-operating system for the bot and you. Tools on the box; visibility and controls through the side door.</p><img src="/shots/desktops-eva-wide.webp" alt="MaxQ desktop operator sheet" loading="lazy" /><span>Explore MaxQ →</span></a>${[products.cue, products.crew, products.router].map(p => `<a class="stack-card" href="#${p.id}" style="--product-accent:var(--${p.tint})"><span class="product-status">${p.name} · Coming soon</span><h2>${p.category.split(" · ")[0]}${p.id === "cue" ? " with context." : p.id === "crew" ? " with execution." : " in view."}</h2><p>${p.intro}</p><img src="${p.image}" alt="${p.alt}" loading="lazy" /><span>Explore ${p.name} →</span></a>`).join("")}</div>
    <section class="product-boundary"><p class="eyebrow">Connection, not a bundle</p><h2>Know which part does the work.</h2><p>Cue prepares media. Crew coordinates project work and execution. Router exposes supported seats and routing signals. MaxQ tailors the bot's Linux computer. Computer access and routing support depend on each product's current implementation.</p><a href="#sidecar">Explore the existing Sidecar transport preview →</a></section></article>`;
}
