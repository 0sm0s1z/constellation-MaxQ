import { WHY, type Why, type WhyId, plate, cine, renderConsole, escapeHtml } from "./pages";

/* Why MaxQ — the three pages after the front page. The front page says what the box is. These
   say why it matters, one problem per page, in the order you meet them: get the bot onto your
   network safely, give it hands and skills, then watch all of it work. Same voice as the home
   beats: short, operator-register, the bot gets / you get. Facts follow the settings sheet
   (theme · proxy · firewall · vault · oauth · skills · resources · triggers) and docs/VISION.md. */

type Card = { k: string; title: string; body: string };
type Step = { title: string; body: string };
type Page = {
  problemEyebrow: string; problemTitle: string; problem: string[]; callout?: { k: string; v: string };
  botGets: string; youGet: string;
  cards: Card[]; steps: Step[]; figure: string;
};

const cards = (list: Card[]) => `
  <ul class="why-grid">${list.map((c) => `
    <li class="why-tile">
      <span class="why-k">${escapeHtml(c.k)}</span>
      <h3>${escapeHtml(c.title)}</h3>
      <p>${c.body}</p>
    </li>`).join("")}</ul>`;

const steps = (list: Step[]) => `
  <ol class="steps why-steps">${list.map((s, i) => `
    <li><span class="step-num">${String(i + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(s.title)}</h3><p>${s.body}</p></div></li>`).join("")}</ol>`;

/* Mono panel in the proof style: a table of live type with a bar and a caption. */
const panel = (bar: [string, string], rows: string[][], cap: [string, string], kind = "") => `
  <figure class="proof why-panel ${kind}">
    <div class="proof-bar"><span>${bar[0]}</span><span>${bar[1]}</span></div>
    <pre><code>${rows.map((r) => r.map((c, i) => {
      if (r.length === 1) return `<span class="ph">${c}</span>`;
      const cls = c === "allow" || c === "on" || c === "ok" || c === "live" ? " ok" : c === "deny" || c === "off" || c === "—" ? " no" : "";
      return i === 0 ? `<span class="pk">${c.padEnd(15)}</span>` : `<span class="pv${cls}">${c.padEnd(i === r.length - 1 ? 0 : 13)}</span>`;
    }).join("")).join("\n")}</code></pre>
    <figcaption><span>${cap[0]}</span><span>${cap[1]}</span></figcaption>
  </figure>`;

const PAGES: Record<WhyId, Page> = {
  access: {
    problemEyebrow: "The problem",
    problemTitle: "The bot lives in the cloud. Your network doesn't.",
    problem: [
      "Grok Bot is a fine assistant for anything on the public internet. The moment you want it to touch something of yours — Home Assistant, the router, a NAS, a printer, an internal wiki — it has to come inside. The docs tell you how to put the box on a private network.",
      "Do that with the stock box and the bot's desktop is on your wire with no password. Every bot on the box shares it. There is no isolation between them, no firewall, no control over what comes in or goes out. We filed three reports against Grok Bot through HackerOne for exactly this; the highest scored 9.8.",
      "Access and security are the same problem. If getting the bot onto your network means opening your network, you haven't gained an assistant. You've gained a hole.",
    ],
    callout: { k: "reported", v: "CVSS 9.8 · 8.8 · 6.6 — open VNC, no isolation, no filtering" },
    botGets: "A route to the things you actually want it to run: your home network, your hardware, your accounts. Credentials it can use without ever holding.",
    youGet: "The bot inside, on your terms. You say which network, which ports, from where. Every secret goes through the vault, not the transcript.",
    cards: [
      { k: "tailnet", title: "Tailscale in the apply", body: "The box joins your tailnet. Nothing is port-forwarded; the internet never learns the box exists. Your laptop, your home, your office, one mesh — and the bot is a node on it." },
      { k: "firewall", title: "Inbound by port. By source.", body: "VNC and noVNC stay on loopback. SSH and the API answer to the tailnet and nothing else. Outbound to <code>192.168.0.0/16</code> only if you say so. A policy you can read, not a hope." },
      { k: "ssh", title: "Keyed access. Your key.", body: "SSH onto the box the way you SSH anywhere. <code>maxq revert</code> never touches your keys; access is yours before, during, and after MaxQ." },
      { k: "vault + oauth", title: "It logs in. It never sees the key.", body: "Put a credential in the vault. The bot asks <code>maxq-api</code> to use it. The secret never appears in chat, on the command line, or in a transcript that gets summarized somewhere you didn't choose." },
      { k: "visibility", title: "What goes where.", body: "Every connection in and out, by bot, by port, by destination. Not a log you grep after the fact — a sheet you glance at while it works." },
    ],
    steps: [
      { title: "Apply", body: "<code>maxq apply</code> lands the firewall with a closed default and starts the API on loopback." },
      { title: "Join the tailnet", body: "Bring the box onto your tailnet from the sheet. Your devices see the box; the internet does not." },
      { title: "Open exactly two doors", body: "SSH and <code>7432</code>, from the tailnet. Leave VNC where it belongs: on the box, behind noVNC on loopback." },
      { title: "Give it a credential", body: "Home Assistant token into the vault. The bot gets a handle, not the token." },
      { title: "Point it at home", body: "Now it can turn the lights off. From your network, through a door you can close." },
    ],
    figure: panel(["firewall", "box@grokbot · tailnet0"], [
      ["inbound"],
      ["tailnet0", "22/tcp", "ssh", "allow", "100.64.0.0/10"],
      ["tailnet0", "7432/tcp", "maxq-api", "allow", "100.64.0.0/10"],
      ["*", "5900/tcp", "vnc", "deny", "0.0.0.0/0"],
      ["*", "6080/tcp", "novnc", "deny", "0.0.0.0/0"],
      ["outbound"],
      ["bot:*", "443/tcp", "https", "allow", "*"],
      ["bot:1", "8123/tcp", "hass", "allow", "192.168.1.20"],
      ["bot:*", "*", "lan", "deny", "192.168.0.0/16"],
      ["vault"],
      ["secrets", "3", "exposed", "0", "vault only"],
    ], ["default deny · loopback for the desktop", "3 secrets · 0 exposed"]),
  },

  control: {
    problemEyebrow: "The problem",
    problemTitle: "The bot arrives with no skills. The only way to give it any is to chat.",
    problem: [
      "There is a marketplace now. It's good. But every skill goes in through the chat window: describe it, stash it, push it, hope it took. Two bots that need the same skill is twice the ceremony. Disabling one is a negotiation.",
      "And the bot's computer is the bot's problem. RAM full, a Chrome profile wedged, a process spinning — you ask it nicely and wait for it to notice. You have no hands on the machine it lives on.",
      "MaxQ puts a small Go program on the box, <code>maxq-api</code>, and gives it your hands. Everything a user of that computer could do, you can do, from the sheet, without taking the bot's hands off the keyboard.",
    ],
    botGets: "Skills before the first task. A box that stays healthy because someone can actually fix it. Files that show up where it expects them.",
    youGet: "Assign, enable, disable, update — per bot. Browse its files in your browser. Trim the hog, restart the wedged profile, kill what needs killing.",
    cards: [
      { k: "skills", title: "The marketplace, per bot.", body: "See what each bot can do. Assign a skill to <code>:1</code> and not <code>:3</code>. Disable, update, roll back. No prompt essay; a switch." },
      { k: "files", title: "Its file system. Your browser.", body: "Browse the box's folders. Drop a fixture in, pull a result out. Its tree and yours are one place while you work, and separate when you close the tab." },
      { k: "processes", title: "Trim. Restart. Kill.", body: "Every process, grouped by agent and Chrome profile. Trim an agent's RAM. Restart its Chrome. Kill a runaway. Put a bot to sleep so the others get the memory." },
      { k: "packages", title: "What's really on the box.", body: "An SBOM of the box in one list: <code>go</code>, <code>node</code>, <code>docker</code>, <code>tailscale</code>, the CLIs. Inventory you can read before you trust it. It does not mutate packages; <code>apply</code> does, on purpose, in <code>$HOME</code>." },
      { k: "desks", title: "Every computer at once.", body: "All the bots' desks on one sheet, live. That's the third page; it's also the thing you'll look at while you do everything on this one." },
    ],
    steps: [
      { title: "Open the sheet", body: "<code>127.0.0.1:7432</code> — or its tailnet address from your laptop." },
      { title: "Skills → assign", body: "Give <code>:1</code> computer-use and home-assistant. Leave <code>:3</code> on code only." },
      { title: "Files → drop the fixture", body: "The CSV lands in the bot's <code>$HOME</code>. It sees it on the next task." },
      { title: "Resources → trim the hog", body: "<code>chrome-profile-2</code> is at 742 MB doing nothing. Trim it. Watch the bar drop." },
      { title: "Back to chat", body: "Now the transcript is about the work, not about the computer." },
    ],
    figure: panel(["skills", "3 bots · marketplace"], [
      ["skill", ":1 grok", ":3 codex", ":5 claude", "updated"],
      ["computer-use", "on", "on", "on", "1.4.2"],
      ["home-assistant", "on", "off", "off", "0.9.0"],
      ["gh-pr", "off", "on", "on", "2.1.0"],
      ["browser-qa", "on", "—", "on", "0.3.1"],
      ["resources"],
      ["chrome-profile-2", "742 MB", "5 proc", "trim", ""],
      ["chrome-profile-5", "2.1 GB", "14 proc", "this agent", ""],
    ], ["assign · enable · update · per bot", "trim · restart · kill"]),
  },

  telemetry: {
    problemEyebrow: "The problem",
    problemTitle: "Grok Bot lets you look at its screen. One bot. One screen. When you ask.",
    problem: [
      "That's fine for one assistant doing one thing. Run three, give them real work, and you're the ops floor for a small team you can't see. The transcript tells you what it thinks it did. It does not tell you the box is at 94% RAM and one of the Chromes has been on a login page for twenty minutes.",
      "Chat is a fine steering wheel. Until something goes wrong. Then you want instruments.",
      "MaxQ multiplexes every desktop on the box through noVNC onto one sheet, meters the box by agent, and lets you set triggers that fire before the box does. You watch the work, not the log.",
    ],
    botGets: "A stable box. Someone notices the RAM before the crash, the stall before the deadline. A RAM problem is a RAM problem, not a mysterious AI failure.",
    youGet: "Every desktop, live, at once. RAM, CPU, and load by agent. A page from the box when a threshold trips, so you act before the postmortem.",
    cards: [
      { k: "desktops", title: "Nine on one sheet. Or fifteen.", body: "Live Xvfb through noVNC, every X display on the box, tiled. Click one to drive it. The current one carries the ring; the idle ones sit dim." },
      { k: "resources", title: "By agent, not by box.", body: "RAM, CPU, load — and which Chrome profile is the hog. The meters you saw on the front page are these, live." },
      { k: "triggers", title: "The box pages you.", body: "<code>resource.mem</code> over 512 MB for 60 s → webhook. Schedule, probe, or shell exit code. A message in your channel before the box falls over, not a stack trace after." },
      { k: "behind the scenes", title: "The STREAM sidebar.", body: "Process list, connections, current desktop, uptime, kernel. What the bot is actually doing under the chat, in a column that's always there." },
      { k: "herdr", title: "Join the terminal.", body: "The bot's shell sessions are multiplexed over the network. Attach and watch the command run, or type into the same session. Not a screenshot of a terminal — the terminal." },
    ],
    steps: [
      { title: "Watch", body: "Nine desks on the sheet. <code>:5</code> is on a login page. <code>:8</code> is compiling." },
      { title: "Notice", body: "RAM 94%. The STREAM sidebar shows <code>chrome-profile-2</code> at 3.4 GB doing nothing." },
      { title: "Act", body: "Kill it from the resources panel. The bar drops. <code>:8</code> keeps compiling." },
      { title: "Prevent", body: "Add a trigger: <code>resource.mem</code> over threshold, webhook to your channel. Next time the box tells you first." },
      { title: "Prove", body: "<code>maxq prove</code>. The box is still <code>APPLIED</code>. Nothing you did touched anything MaxQ doesn't own." },
    ],
    figure: "",
  },
};

const whyNext = (w: Why) => {
  const i = WHY.findIndex((x) => x.id === w.id);
  const prev = WHY[i - 1];
  const next = WHY[i + 1];
  return `
    <nav class="why-next" aria-label="Why MaxQ pages">
      ${prev ? `<a class="why-prev" href="#${prev.id}"><span class="eyebrow">← ${prev.num}</span><strong>${escapeHtml(prev.label)}</strong></a>` : `<a class="why-prev" href="#why"><span class="eyebrow">← Home</span><strong>What MaxQ is</strong></a>`}
      ${next ? `<a class="why-fwd" href="#${next.id}"><span class="eyebrow">${next.num} →</span><strong>${escapeHtml(next.label)}</strong></a>` : `<a class="why-fwd" href="#install"><span class="eyebrow">Ready →</span><strong>Install MaxQ</strong></a>`}
    </nav>`;
};

export function renderWhy(id: WhyId): string {
  const w = WHY.find((x) => x.id === id) ?? WHY[0];
  const p = PAGES[w.id];
  const telemetry = w.id === "telemetry";
  const figure = telemetry
    ? cine("/shots/desktops-eva-cine.webp", "MaxQ operator desktops: nine live sessions and the STREAM sidebar", 1600, 727, "maxq · every desktop", "14 / 22 live")
    : p.figure;
  const after = telemetry ? `
      <section class="why-sec why-live">
        <div class="section-head why-sec-head">
          <p class="eyebrow">Live</p>
          <h2 class="display">The sheet, as type. Put a hand on it.</h2>
        </div>
        ${renderConsole(false)}
      </section>` : "";
  return `
    <article class="why-page" data-tint="${w.tint}">
      <header class="beat-head has-plate why-hero">
        ${plate(w.art, w.artAlt, w.artKind)}
        <div>
          <p class="eyebrow">Why MaxQ · ${w.num} · ${escapeHtml(w.label)}</p>
          <h1 class="display">${escapeHtml(w.title)}</h1>
          <p class="lede">${escapeHtml(w.one)}</p>
          <dl class="split">
            <div><dt>The bot gets</dt><dd>${p.botGets}</dd></div>
            <div><dt>You get</dt><dd>${p.youGet}</dd></div>
          </dl>
        </div>
      </header>

      <section class="why-sec why-problem">
        <div>
          <p class="eyebrow">${p.problemEyebrow}</p>
          <h2 class="display">${escapeHtml(p.problemTitle)}</h2>
        </div>
        <div class="why-prose">
          ${p.problem.map((t) => `<p>${t}</p>`).join("")}
          ${p.callout ? `<p class="why-callout"><span class="why-k">${escapeHtml(p.callout.k)}</span>${escapeHtml(p.callout.v)}</p>` : ""}
        </div>
      </section>

      <section class="why-sec">
        <div class="section-head why-sec-head">
          <p class="eyebrow">What the side door does</p>
          <h2 class="display">${w.id === "access" ? "Inside, on your terms." : w.id === "control" ? "Your hands on its computer." : "Instruments, not a transcript."}</h2>
        </div>
        ${cards(p.cards)}
      </section>

      <section class="why-sec why-journey">
        <div>
          <p class="eyebrow">The journey</p>
          <h2 class="display">${w.id === "access" ? "From stock box to a node on your network." : w.id === "control" ? "Five minutes, no prompt essay." : "Watch. Notice. Act. Prevent. Prove."}</h2>
          ${steps(p.steps)}
        </div>
        <div class="why-figure">${figure}</div>
      </section>
      ${after}

      ${whyNext(w)}
    </article>`;
}
