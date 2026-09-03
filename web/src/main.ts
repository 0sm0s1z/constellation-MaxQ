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


function bindCarousel(root: HTMLElement) {
  const box = root.querySelector<HTMLElement>("[data-carousel]");
  if (!box) return;
  const slides = [...box.querySelectorAll<HTMLElement>(".slide")];
  const dots = [...box.querySelectorAll<HTMLButtonElement>("[data-dot]")];
  let i = 0;
  let timer = 0;
  const show = (n: number) => {
    i = ((n % slides.length) + slides.length) % slides.length;
    slides.forEach((s, k) => {
      const on = k === i;
      s.classList.toggle("is-on", on);
      s.hidden = !on;
    });
    dots.forEach((d, k) => d.classList.toggle("is-on", k === i));
  };
  const play = () => {
    window.clearInterval(timer);
    timer = window.setInterval(() => show(i + 1), 4200);
  };
  dots.forEach((d) => d.addEventListener("click", () => { show(Number(d.dataset.dot)); play(); }));
  box.addEventListener("mouseenter", () => window.clearInterval(timer));
  box.addEventListener("mouseleave", play);
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) play();
    else window.clearInterval(timer);
  }, { threshold: 0.35 });
  io.observe(box);
  show(0);
}

function bindRocketFlip(root: HTMLElement) {
  const flip = root.querySelector<HTMLElement>("[data-rocket-flip]");
  const slide = root.querySelector<HTMLElement>(".rocket-slide");
  if (!flip || !slide) return;
  const frames = [...flip.querySelectorAll<HTMLImageElement>("img")];
  if (frames.length < 2) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  const order = [0, 1, 2, 3, 2, 1];
  let step = 0;
  let timer = 0;
  const paint = (n: number) => {
    frames.forEach((img, k) => img.classList.toggle("is-frame", k === n));
  };
  const stop = () => { window.clearInterval(timer); timer = 0; };
  const play = () => {
    if (timer || !slide.classList.contains("is-on")) return;
    flip.classList.add("is-playing");
    paint(order[step]);
    timer = window.setInterval(() => {
      step = (step + 1) % order.length;
      paint(order[step]);
    }, 280);
  };
  const mo = new MutationObserver(() => {
    if (slide.classList.contains("is-on")) play();
    else { stop(); step = 0; paint(0); flip.classList.remove("is-playing"); }
  });
  mo.observe(slide, { attributes: true, attributeFilter: ["class"] });
  play();
}

function draw() {
  const app = document.getElementById("app");
  if (!app) return;
  const route = parseRoute();
  app.innerHTML = shell(routes[route].draw(), route);
  bindCopy(app);
  bindTabs(app);
  bindCarousel(app);
  bindRocketFlip(app);
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
