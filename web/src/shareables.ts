/** #123 Shareables — bots / skills / tools. Homepage craft SoT. First skill: Herdr. */

export type ShareKind = "bots" | "skills" | "tools";

export type Shareable = {
  id: string;
  kind: ShareKind;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  packPath?: string;
  github: string;
  related?: { label: string; href: string }[];
  frontmatter: Record<string, string>;
  body: string;
};

const HERDR: Shareable = {
  id: "herdr",
  kind: "skills",
  name: "Herdr",
  tagline: "Terminal multiplexer for coding agents — panes, tabs, workspaces.",
  description:
    "Control Herdr when the operator explicitly asks. Requires HERDR_ENV=1. Pair with poll + webhook routines for a Grok Bot ↔ remote TUI development loop.",
  icon: "/icons/herdr.svg",
  packPath: "share/skills/herdr",
  github: "https://github.com/0sm0s1z/constellation-MaxQ/tree/main/share/skills/herdr",
  related: [
    { label: "SKILL.md on GitHub", href: "https://github.com/0sm0s1z/constellation-MaxQ/blob/main/share/skills/herdr/SKILL.md" },
    { label: "Docs (when live)", href: "#docs" },
  ],
  frontmatter: {
    name: "herdr",
    description:
      "Control Herdr, a terminal multiplexer for coding agents. Use only when the user explicitly mentions Herdr. Requires HERDR_ENV=1. Release-matched details: herdr --skill.",
  },
  body: `Herdr organizes terminals into workspaces, tabs, and panes, recognizes coding agents inside panes, and exposes the current session through the \`herdr\` CLI.

## Principle
MaxQ ships the **opportunity** — this installable skill plus \`herdr\` on PATH. It does **not** configure Herdr layouts or agents for the operator.

## When to use
Only when the operator explicitly asks about **Herdr** (panes, tabs, workspaces, agent control).

## Guard
Before any control command, verify this agent is inside a Herdr-managed pane:

\`\`\`bash
test "\${HERDR_ENV:-}" = 1
\`\`\`

If that fails, say you are not inside Herdr and stop.

## Learn the current CLI
\`\`\`bash
herdr --help
herdr --skill
herdr agent
herdr pane
\`\`\`

## Dev loop (why this is the first shareable)
Install this skill on the Grok Bot that drives development, plus poll + webhook routines that re-check Herdr panes. On the remote TUI host, install a companion skill that fires the webhook when a run completes. The bot prompts the TUI; the TUI finishes and pings the bot back.`,
};

export const SHAREABLES: Shareable[] = [HERDR];

const KINDS: { id: ShareKind; label: string; empty: string }[] = [
  { id: "bots", label: "Bots", empty: "No shared bots yet — Skills first." },
  { id: "skills", label: "Skills", empty: "No skills in this filter." },
  { id: "tools", label: "Tools", empty: "No shared tools yet — Skills first." },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mdLite(src: string): string {
  // Minimal markdown for panel body — headings, code fences, paragraphs, bold
  const lines = src.split("\n");
  const out: string[] = [];
  let inCode = false;
  let code: string[] = [];
  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(`<h3>${escapeHtml(line.slice(3))}</h3>`);
    } else if (line.startsWith("# ")) {
      out.push(`<h2>${escapeHtml(line.slice(2))}</h2>`);
    } else if (line.trim() === "") {
      out.push("");
    } else {
      const withBold = escapeHtml(line).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      const withCode = withBold.replace(/`([^`]+)`/g, "<code>$1</code>");
      out.push(`<p>${withCode}</p>`);
    }
  }
  if (inCode) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return out.join("\n");
}

function parseShareHash(): { kind: ShareKind; id: string | null } {
  const hash = (location.hash || "#shareables").replace("#", "");
  // shareables | shareables/skills | shareables/skills/herdr
  const parts = hash.split("/");
  const kind = (parts[1] as ShareKind) || "skills";
  const valid = KINDS.some((k) => k.id === kind) ? kind : "skills";
  const id = parts[2] || null;
  return { kind: valid, id };
}

export function renderShareables(): string {
  const { kind, id } = parseShareHash();
  const tabs = KINDS.map(
    (k) =>
      `<button type="button" class="share-tab${k.id === kind ? " active" : ""}" data-share-kind="${k.id}" aria-selected="${k.id === kind}">${k.label}</button>`
  ).join("");

  const items = SHAREABLES.filter((s) => s.kind === kind);
  const tiles =
    items.length === 0
      ? `<p class="share-empty">${escapeHtml(KINDS.find((k) => k.id === kind)!.empty)}</p>`
      : `<div class="share-grid" data-share-grid>${items
          .map(
            (s) => `
        <button type="button" class="share-tile${id === s.id ? " is-open" : ""}" data-share-open="${s.id}" data-share-kind="${s.kind}">
          <span class="share-tile-icon" aria-hidden="true"><img src="${s.icon}" alt="" width="40" height="40" /></span>
          <span class="share-tile-copy">
            <span class="share-tile-name">${escapeHtml(s.name)}</span>
            <span class="share-tile-tag">${escapeHtml(s.tagline)}</span>
          </span>
        </button>`
          )
          .join("")}</div>`;

  const open = id ? SHAREABLES.find((s) => s.id === id && s.kind === kind) : null;
  const panel = open
    ? `
    <aside class="share-panel is-open" data-share-panel role="dialog" aria-label="${escapeHtml(open.name)} details">
      <div class="share-panel-bar">
        <p class="eyebrow">${open.kind} · shareable</p>
        <button type="button" class="share-panel-close" data-share-close aria-label="Close">Close</button>
      </div>
      <div class="share-panel-head">
        <img class="share-panel-icon" src="${open.icon}" alt="" width="56" height="56" />
        <div>
          <h1>${escapeHtml(open.name)}</h1>
          <p class="lede">${escapeHtml(open.description)}</p>
        </div>
      </div>
      <div class="share-panel-meta">
        ${open.packPath ? `<div><span class="k">pack</span><code>${escapeHtml(open.packPath)}</code></div>` : ""}
        <div><span class="k">name</span><code>${escapeHtml(open.frontmatter.name || open.id)}</code></div>
      </div>
      <div class="cta-row">
        <a class="btn-solid" href="${open.github}" target="_blank" rel="noopener noreferrer">View on GitHub</a>
        ${(open.related || [])
          .map((r) => `<a class="btn-ghost" href="${r.href}"${r.href.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(r.label)}</a>`)
          .join("")}
      </div>
      <div class="share-panel-body">${mdLite(open.body)}</div>
    </aside>`
    : `<aside class="share-panel" data-share-panel hidden></aside>`;

  return `
    <section class="share-hero block">
      <p class="eyebrow">Shareables</p>
      <h1>From our desk to <span class="grad">yours.</span></h1>
      <p class="lede">Bots, skills, and tools we actually run with MaxQ and Grok Bot — polished enough to share. Install the pack; MaxQ does not configure it for you.</p>
    </section>
    <section class="share-shell${open ? " has-panel" : ""}" data-share-shell>
      <div class="share-main">
        <div class="share-toolbar">
          <div class="share-tabs" role="tablist">${tabs}</div>
          <label class="share-search">
            <span class="visually-hidden">Search shareables</span>
            <input type="search" placeholder="Search" data-share-search autocomplete="off" />
          </label>
        </div>
        ${tiles}
      </div>
      ${panel}
    </section>`;
}

export function bindShareables(root: HTMLElement) {
  const shell = root.querySelector<HTMLElement>("[data-share-shell]");
  if (!shell) return;

  const go = (kind: ShareKind, id?: string | null) => {
    location.hash = id ? `shareables/${kind}/${id}` : `shareables/${kind}`;
  };

  shell.querySelectorAll<HTMLButtonElement>("[data-share-kind].share-tab").forEach((btn) => {
    btn.addEventListener("click", () => go(btn.dataset.shareKind as ShareKind));
  });

  shell.querySelectorAll<HTMLButtonElement>("[data-share-open]").forEach((btn) => {
    btn.addEventListener("click", () =>
      go((btn.dataset.shareKind as ShareKind) || "skills", btn.dataset.shareOpen)
    );
  });

  shell.querySelectorAll<HTMLButtonElement>("[data-share-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { kind } = parseShareHash();
      go(kind);
    });
  });

  const input = shell.querySelector<HTMLInputElement>("[data-share-search]");
  const grid = shell.querySelector<HTMLElement>("[data-share-grid]");
  input?.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    grid?.querySelectorAll<HTMLElement>(".share-tile").forEach((tile) => {
      const text = tile.textContent?.toLowerCase() || "";
      tile.hidden = Boolean(q) && !text.includes(q);
    });
  });
}
