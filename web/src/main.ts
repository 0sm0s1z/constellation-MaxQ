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
    <div class="accent pastel-flow" aria-hidden="true"></div>
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
  const locked = box.hasAttribute("data-carousel-lock");
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
    if (locked) return;
    window.clearInterval(timer);
    timer = window.setInterval(() => show(i + 1), 4200);
  };
  dots.forEach((d) => d.addEventListener("click", () => {
    show(Number(d.dataset.dot));
    if (!locked) play();
  }));
  if (!locked) {
    box.addEventListener("mouseenter", () => window.clearInterval(timer));
    box.addEventListener("mouseleave", play);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) play();
      else window.clearInterval(timer);
    }, { threshold: 0.35 });
    io.observe(box);
  }
  show(0);
}

/* The launch video is the master clock. Copy reveals key off `playing`; telemetry lights at
   apogee (3.5s in the Cue composition); the video is not looped so the rocket holds at the top. */
const APOGEE_S = 3.5;
function bindLaunch(root: HTMLElement) {
  const launch = root.querySelector<HTMLElement>("[data-launch]");
  if (!launch || launch.classList.contains("is-live")) return;
  const video = launch.querySelector<HTMLVideoElement>("video.launch-video");
  const gif = launch.querySelector<HTMLImageElement>("img.launch-gif");
  let apogeeTimer = 0;
  const live = () => {
    if (launch.classList.contains("is-live")) return;
    launch.classList.add("is-live");
    apogeeTimer = window.setTimeout(() => launch.classList.add("is-apogee"), APOGEE_S * 1000);
  };
  const held = () => launch.classList.add("is-apogee", "is-held");
  bindGlass(launch);
  if (!video) { live(); held(); return; }
  const showGif = () => {
    if (gif) {
      const src = gif.dataset.src;
      if (src && gif.getAttribute("src") !== src) gif.src = src;
      gif.hidden = false;
    }
    video.remove();
    live();
  };
  video.addEventListener("playing", live, { once: true });
  video.addEventListener("timeupdate", () => {
    if (video.currentTime >= APOGEE_S) {
      window.clearTimeout(apogeeTimer);
      launch.classList.add("is-apogee");
    }
  });
  video.addEventListener("ended", held, { once: true });
  video.addEventListener("error", showGif);
  video.querySelector("source")?.addEventListener("error", showGif);
  // Autoplay refused (data saver, policy): show the copy anyway and hold the poster frame.
  window.setTimeout(() => {
    if (!launch.classList.contains("is-live")) {
      video.play().catch(() => undefined);
      live();
      if (video.paused) held();
    }
  }, 900);
}

/* The glass cycles one shot at a time once the rocket is holding. The shot on screen names the
   telemetry key that glows, so the bottom edge of the canvas keeps a heartbeat after the flight. */
const GLASS_PERIOD_MS = 5200;
function bindGlass(launch: HTMLElement) {
  const glass = launch.querySelector<HTMLElement>("[data-glass]");
  if (!glass) return;
  const frames = [...glass.querySelectorAll<HTMLImageElement>(".glass-frame img")];
  const caps = [...glass.querySelectorAll<HTMLButtonElement>("[data-glass-to]")];
  const tele = [...launch.querySelectorAll<HTMLElement>(".telemetry li[data-key]")];
  if (!frames.length) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let i = 0;
  let timer = 0;
  const show = (n: number) => {
    i = ((n % frames.length) + frames.length) % frames.length;
    frames.forEach((f, k) => f.classList.toggle("is-on", k === i));
    caps.forEach((c, k) => c.classList.toggle("is-on", k === i));
    const hot = frames[i].dataset.tele;
    tele.forEach((t) => t.classList.toggle("is-hot", t.dataset.key === hot));
  };
  const stop = () => window.clearInterval(timer);
  const play = () => {
    stop();
    if (reduced) return;
    timer = window.setInterval(() => show(i + 1), GLASS_PERIOD_MS);
  };
  caps.forEach((c) => c.addEventListener("click", () => { show(Number(c.dataset.glassTo)); play(); }));
  glass.addEventListener("mouseenter", stop);
  glass.addEventListener("mouseleave", play);
  glass.addEventListener("focusin", stop);
  glass.addEventListener("focusout", play);
  // Start the cycle only after the glass has landed (apogee + reveal).
  const start = () => {
    if (!launch.classList.contains("is-apogee")) return false;
    show(0);
    window.setTimeout(play, 1400);
    return true;
  };
  if (!start()) {
    const mo = new MutationObserver(() => { if (start()) mo.disconnect(); });
    mo.observe(launch, { attributes: true, attributeFilter: ["class"] });
  }
}

function draw() {
  const app = document.getElementById("app");
  if (!app) return;
  const route = parseRoute();
  app.innerHTML = shell(routes[route].draw(), route);
  bindCopy(app);
  bindTabs(app);
  bindCarousel(app);
  bindLaunch(app);
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
