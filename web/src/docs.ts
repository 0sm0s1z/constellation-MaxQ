import { marked } from "marked";
import overview from "../docs/pages/overview.md?raw";
import install from "../docs/pages/install.md?raw";
import operatorGlass from "../docs/pages/operator-glass.md?raw";
import invariants from "../docs/pages/invariants.md?raw";
import computerUseBrowser from "../docs/pages/computer-use-browser.md?raw";
import theme from "../docs/pages/theme.md?raw";
import clisPackages from "../docs/pages/clis-packages.md?raw";
import controlApi from "../docs/pages/control-api.md?raw";

export const DOCS = [
  { slug: "overview", label: "Overview", source: overview },
  { slug: "install", label: "Install / apply / prove / revert", source: install },
  { slug: "operator-glass", label: "Operator glass", source: operatorGlass },
  { slug: "invariants", label: "Invariants / trust", source: invariants },
  { slug: "computer-use-browser", label: "Computer-use browser", source: computerUseBrowser },
  { slug: "theme", label: "Theme / wallpaper / dark mode", source: theme },
  { slug: "clis-packages", label: "CLIs / packages", source: clisPackages },
  { slug: "control-api", label: "Control API", source: controlApi },
] as const;

export type DocSlug = (typeof DOCS)[number]["slug"];

export function parseDocSlug(): DocSlug {
  const slug = location.hash.replace(/^#docs\/?/, "");
  return DOCS.some((page) => page.slug === slug) ? (slug as DocSlug) : "overview";
}

export function renderDocs(): string {
  const slug = parseDocSlug();
  const page = DOCS.find((candidate) => candidate.slug === slug) ?? DOCS[0];
  const navigation = DOCS.map(
    (candidate) =>
      `<a href="#docs/${candidate.slug}"${candidate.slug === slug ? ' class="active" aria-current="page"' : ""}>${candidate.label}</a>`
  ).join("");

  return `
    <div class="docs-shell">
      <aside class="docs-nav" aria-label="Documentation">
        <p class="eyebrow">MaxQ docs</p>
        <nav>${navigation}</nav>
        <a class="docs-source" href="https://github.com/0sm0s1z/constellation-MaxQ/tree/main/docs">Repository docs ↗</a>
      </aside>
      <main class="docs-content">
        <article class="docs-article">${String(marked.parse(page.source))}</article>
        <nav class="docs-mobile-nav" aria-label="Documentation pages">${navigation}</nav>
      </main>
    </div>`;
}
