import {
  parseRoute, renderHome, renderInstall, renderInvariants, renderOps,
  renderStack, renderRouter, renderCue, renderCrew, GITHUB, type Route,
} from "./pages";
import { mountStarfield } from "./starfield";

const routes: Record<Route, { label: string; draw: () => string }> = {
  home: { label: "maxq", draw: renderHome },
  stack: { label: "stack", draw: renderStack },
  router: { label: "router", draw: renderRouter },
  cue: { label: "cue", draw: renderCue },
  crew: { label: "crew", draw: renderCrew },
  install: { label: "install", draw: renderInstall },
  invariants: { label: "invariants", draw: renderInvariants },
  ops: { label: "ops", draw: renderOps },
};

const NAV: Route[] = ["home", "stack", "router", "cue", "crew"];

function shell(inner: string, route: Route): string {
  const links = NAV.map((key) => {
    const active = key === route ? " active" : "";
    return `<a class="${active}" href="#${key}">${routes[key].label}</a>`;
  }).join("");
  return `
    <header class="topbar">
      <a class="brand" href="#home">
        <span class="brand-kicker">Constellation</span>
        <img class="namelogo" src="/namelogo.webp" alt="MaxQ" width="1319" height="318" />
      </a>
      <nav class="nav">${links}</nav>
      <div class="nav-end">
        <a class="btn-ghost btn-sm" href="${GITHUB}">GitHub</a>
        <a class="btn-solid btn-sm" href="#install">Install</a>
      </div>
    </header>
    <div class="accent" aria-hidden="true"></div>
    ${inner}
    <footer class="foot">
      <span>MIT · mocha</span>
      <span>
        <a href="#invariants">invariants</a>
        · <a href="#ops">ops</a>
        · <a href="${GITHUB}">github</a>
        · <a href="${GITHUB}/blob/main/docs/TRUST.md">trust</a>
      </span>
    </footer>`;
}

function bindCopy(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>("button.copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy ?? "";
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "copied"; btn.classList.add("ok");
        window.setTimeout(() => { btn.textContent = "copy"; btn.classList.remove("ok"); }, 1400);
      } catch { btn.textContent = "fail"; }
    });
  });
}

function bindTabs(root: HTMLElement) {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const panels = [...root.querySelectorAll<HTMLElement>("[data-panel]")];
  if (!tabs.length) return;
  const show = (id: string) => {
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === id));
    panels.forEach((p) => {
      const on = p.dataset.panel === id;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
  };
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => show(tab.dataset.tab ?? "router"));
  });
}

function draw() {
  const app = document.getElementById("app");
  if (!app) return;
  const route = parseRoute();
  app.innerHTML = shell(routes[route].draw(), route);
  bindCopy(app);
  bindTabs(app);
}

function dismissLoader() {
  const el = document.getElementById("loader");
  if (!el) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    el.remove();
    return;
  }
  el.classList.add("out");
  window.setTimeout(() => el.remove(), 480);
}

const canvas = document.getElementById("stars");
if (canvas instanceof HTMLCanvasElement) mountStarfield(canvas);
draw();
window.addEventListener("hashchange", draw);

if (document.readyState === "complete") dismissLoader();
else window.addEventListener("load", dismissLoader);
