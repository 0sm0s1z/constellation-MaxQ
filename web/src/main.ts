import {
  parseRoute, renderHome, renderInstall, renderInvariants, renderOps,
  GITHUB, GET_MAXQ, WHY, type Route,
} from "./pages";
import { renderProduct, renderProductStack } from "./products";
import { renderSidecar } from "./sidecar";
import { renderWhy } from "./why";
import { renderFrontier } from "./frontier";
import { mountStarfield } from "./starfield";

const routes: Record<Route, { label: string; draw: () => string }> = {
  home: { label: "maxq", draw: renderHome },
  stack: { label: "stack", draw: renderProductStack },
  router: { label: "router", draw: () => renderProduct("router") },
  sidecar: { label: "sidecar", draw: renderSidecar },
  cue: { label: "cue", draw: () => renderProduct("cue") },
  crew: { label: "crew", draw: () => renderProduct("crew") },
  install: { label: "install", draw: renderInstall },
  invariants: { label: "invariants", draw: renderInvariants },
  ops: { label: "ops", draw: renderOps },
  frontier: { label: "frontier", draw: renderFrontier },
  access: { label: "access", draw: () => renderWhy("access") },
  control: { label: "control", draw: () => renderWhy("control") },
  telemetry: { label: "telemetry", draw: () => renderWhy("telemetry") },
};

/* Topbar: the site is about MaxQ. The why pages sit in the bar on MaxQ/why routes; product pages
   keep the bar product-focused so the 01/02/03 rail does not read like dead secondary nav. */
const PRODUCTS: { key: Route; num: string; note: string }[] = [
  { key: "router", num: "01", note: "capacity & decisions" },
  { key: "sidecar", num: "02", note: "local transport" },
  { key: "home", num: "03", note: "the bot's box" },
  { key: "cue", num: "04", note: "capture & compose" },
  { key: "crew", num: "05", note: "persistent teammates" },
  { key: "stack", num: "··", note: "the product map" },
];

function shell(inner: string, route: Route): string {
  const productOpen = (["router", "sidecar", "cue", "crew", "stack"] as Route[]).includes(route);
  const comingSoonProduct = (["router", "sidecar", "cue", "crew"] as Route[]).includes(route);
  const products = PRODUCTS.map((p) => {
    const active = p.key === route && route !== "home" ? " active" : "";
    const label = p.key === "home" ? "maxq" : routes[p.key].label;
    return `<a class="menu-item${active}" href="#${p.key}"><span class="menu-num">${p.num}</span><span class="menu-label">${label}</span><span class="menu-note">${p.note}</span></a>`;
  }).join("");
  const why = productOpen ? "" : WHY.map((w) => {
    const active = w.id === route ? " active" : "";
    return `<a class="${active}" href="#${w.id}"><span class="nav-num">${w.num}</span>${w.short}</a>`;
  }).join("");
  const whyRail = why ? `<span class="nav-sep" aria-hidden="true"></span>${why}` : "";
  const actions = comingSoonProduct
    ? `<a class="btn-ghost btn-sm" href="#stack">Explore the stack</a>`
    : `<a class="btn-ghost btn-sm" href="${GITHUB}">GitHub</a>
        <a class="btn-ghost btn-sm" href="${GET_MAXQ}" target="_blank" rel="noopener noreferrer">Get MaxQ</a>
        <a class="btn-solid btn-sm" href="#install">Install</a>`;
  return `
    <a class="skip-link" href="#main-content" data-section="main-content">Skip to content</a><header class="topbar" data-topbar>
      <a class="brand" href="#home">
        <span class="brand-kicker">Constellation</span>
        <img class="namelogo" src="/namelogo.webp" alt="MaxQ" width="1319" height="318" />
      </a>
      <nav class="nav" data-nav>
        <details class="menu${productOpen ? " active" : ""}" data-menu>
          <summary>products <i aria-hidden="true"></i></summary>
          <div class="menu-sheet">${products}</div>
        </details>
        ${whyRail}
      </nav>
      <div class="nav-end">
        ${actions}
        <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Menu"><span></span><span></span></button>
      </div>
    </header>
    <div class="accent pastel-flow" aria-hidden="true"></div>
    <main id="main-content" tabindex="-1">${inner}</main>
    <footer class="foot">
      <span>MIT · mocha</span>
      <span>
        <a href="#invariants">invariants</a>
        · <a href="#ops">ops</a>
        · <a href="#frontier">frontier</a>
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
    tabs.forEach(t => {
      const on = t.dataset.tab === id;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(p => {
      const on = p.dataset.panel === id;
      p.hidden = !on;
      p.classList.toggle("active", on);
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => show(tab.dataset.tab!));
    tab.addEventListener("keydown", e => {
      const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
      if (next < 0) return;
      e.preventDefault();
      show(tabs[next].dataset.tab!);
      tabs[next].focus();
    });
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

const APOGEE_S = 3.5;
function bindLaunch(root: HTMLElement) {
  const launch = root.querySelector<HTMLElement>("[data-launch]");
  if (!launch) return;
  bindGlass(launch);
  if (launch.classList.contains("is-live")) return;
  const video = launch.querySelector<HTMLVideoElement>("video.launch-video");
  const gif = launch.querySelector<HTMLImageElement>("img.launch-gif");
  let apogeeTimer = 0;
  const live = () => {
    if (launch.classList.contains("is-live")) return;
    launch.classList.add("is-live");
    apogeeTimer = window.setTimeout(() => launch.classList.add("is-apogee"), APOGEE_S * 1000);
  };
  const held = () => launch.classList.add("is-apogee", "is-held");
  if (!video) { live(); held(); return; }
  const showGif = () => {
    if (gif) {
      const src = gif.dataset.src;
      if (src && gif.getAttribute("src") !== src) gif.src = src;
      gif.hidden = false;
    }
    video.remove();
    launch.classList.add("is-bitmap");
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
  window.setTimeout(() => {
    if (!launch.classList.contains("is-live")) {
      video.play().catch(() => undefined);
      live();
      if (video.paused) held();
    }
  }, 900);
}

const GLASS_PERIOD_MS = 6500;
function bindGlass(launch: HTMLElement) {
  const glass = launch.querySelector<HTMLElement>("[data-glass]");
  if (!glass) return;
  const frames = [...glass.querySelectorAll<HTMLImageElement>(".glass-frame")];
  const caps = [...glass.querySelectorAll<HTMLButtonElement>("[data-glass-to]")];
  const tele = [...launch.querySelectorAll<HTMLElement>(".telemetry li[data-key]")];
  const split = launch.querySelector<HTMLElement>("[data-split]");
  const bot = launch.querySelector<HTMLElement>("[data-split-bot]");
  const you = launch.querySelector<HTMLElement>("[data-split-you]");
  const chip = launch.querySelector<HTMLElement>("[data-glass-chip]");
  const link = launch.querySelector<HTMLAnchorElement>("[data-glass-link]");
  if (!frames.length) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let i = 0;
  let timer = 0;
  const ripple = (el: HTMLElement | null) => {
    if (!el || reduced) return;
    el.classList.remove("is-ripple");
    void el.offsetWidth;
    el.classList.add("is-ripple");
  };
  const show = (n: number) => {
    i = ((n % frames.length) + frames.length) % frames.length;
    frames.forEach((f, k) => f.classList.toggle("is-on", k === i));
    caps.forEach((c, k) => {
      const on = k === i;
      c.classList.toggle("is-on", on);
      c.setAttribute("aria-selected", on ? "true" : "false");
    });
    const frame = frames[i];
    const hot = frame.dataset.tele;
    tele.forEach((t) => t.classList.toggle("is-hot", t.dataset.key === hot));
    if (bot && frame.dataset.bot) bot.textContent = frame.dataset.bot;
    if (you && frame.dataset.you) you.textContent = frame.dataset.you;
    if (chip && frame.dataset.chip) chip.textContent = frame.dataset.chip;
    if (link && frame.dataset.href) link.href = frame.dataset.href;
    const well = glass.querySelector<HTMLElement>(".glass-well");
    if (well) {
      const desk = i === 0;
      well.classList.toggle("is-desk", desk);
      well.classList.toggle("is-live", desk);
    }
    ripple(split);
    ripple(chip);
  };
  const stop = () => window.clearInterval(timer);
  const play = () => {
    stop();
    if (reduced) return;
    timer = window.setInterval(() => show(i + 1), GLASS_PERIOD_MS);
  };
  caps.forEach((c) => c.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    show(Number(c.dataset.glassTo));
    play();
  }));
  glass.addEventListener("mouseenter", stop);
  glass.addEventListener("mouseleave", play);
  glass.addEventListener("focusin", stop);
  glass.addEventListener("focusout", play);
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

let menuListeners = false;
function bindNav(root: HTMLElement) {
  const bar = root.querySelector<HTMLElement>("[data-topbar]");
  const menu = root.querySelector<HTMLDetailsElement>("[data-menu]");
  const toggle = root.querySelector<HTMLButtonElement>("[data-nav-toggle]");
  const nav = root.querySelector<HTMLElement>("[data-nav]");
  if (nav) nav.id = "site-nav";
  if (menu) {
    if (!menuListeners) {
      menuListeners = true;
      const live = () => document.querySelector<HTMLDetailsElement>("[data-menu]");
      document.addEventListener("click", (ev) => {
        const m = live();
        if (!m?.open) return;
        if (!(ev.target instanceof Node) || !m.contains(ev.target)) m.open = false;
      });
      document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") { const m = live(); if (m?.open) { m.open = false; m.querySelector("summary")?.focus(); }
        const bar = document.querySelector("[data-topbar]");
        if (bar?.classList.contains("is-open")) { bar.classList.remove("is-open"); const toggle = bar.querySelector<HTMLButtonElement>("[data-nav-toggle]"); toggle?.setAttribute("aria-expanded", "false"); toggle?.focus(); } } });
    }
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { menu.open = false; }));
  }
  if (bar && toggle) {
    toggle.addEventListener("click", () => {
      const open = !bar.classList.contains("is-open");
      bar.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav?.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      bar.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }));
  }
}

function bindReveal(root: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
    if (reduced) { el.classList.add("is-live"); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { el.classList.add("is-live"); io.disconnect(); }
    }, { threshold: 0.18 });
    io.observe(el);
  });
}

function bindDesk(root: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.querySelectorAll<HTMLElement>("[data-desk]").forEach((el) => {
    if (reduced) {
      el.classList.add("is-live");
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        el.classList.add("is-live");
        io.disconnect();
      }
    }, { threshold: 0.28 });
    io.observe(el);
  });
}

const SHEET_PERIOD_MS = 2600;
const METER_PERIOD_MS = 1400;
const RAM_TOTAL_GB = 15.6;
const RAM_BASE_GB = 2.3;
function bindConsole(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>("[data-console]");
  if (!grid) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = (n: number) => String(n).padStart(2, "0");

  const sheet = grid.querySelector<HTMLElement>("[data-sheet]");
  const tiles = [...grid.querySelectorAll<HTMLButtonElement>("[data-tile]")];
  const liveTiles = tiles.filter((t) => t.classList.contains("is-live"));
  const current = grid.querySelector<HTMLElement>("[data-current]");
  let cur = Math.max(0, liveTiles.findIndex((t) => t.classList.contains("is-current")));
  let sheetTimer = 0;
  const showTile = (n: number) => {
    if (!liveTiles.length) return;
    cur = ((n % liveTiles.length) + liveTiles.length) % liveTiles.length;
    liveTiles.forEach((t, k) => t.classList.toggle("is-current", k === cur));
    if (current) current.textContent = `:${liveTiles[cur].dataset.tile}`;
  };
  const sheetStop = () => window.clearInterval(sheetTimer);
  const sheetPlay = () => {
    sheetStop();
    if (reduced) return;
    sheetTimer = window.setInterval(() => showTile(cur + 1), SHEET_PERIOD_MS);
  };
  liveTiles.forEach((t, k) => {
    t.addEventListener("mouseenter", () => showTile(k));
    t.addEventListener("focus", () => showTile(k));
    t.addEventListener("click", () => showTile(k));
  });
  if (sheet) {
    sheet.addEventListener("mouseenter", sheetStop);
    sheet.addEventListener("mouseleave", sheetPlay);
    sheet.addEventListener("focusin", sheetStop);
    sheet.addEventListener("focusout", sheetPlay);
  }

  const procs = grid.querySelector<HTMLElement>("[data-procs]");
  const log = grid.querySelector<HTMLElement>("[data-log]");
  const restore = grid.querySelector<HTMLButtonElement>("[data-restore]");
  const clock = grid.querySelector<HTMLElement>("[data-clock]");
  const cpuMeter = grid.querySelector<HTMLElement>('[data-meter="cpu"]');
  const ramMeter = grid.querySelector<HTMLElement>('[data-meter="ram"]');
  const ramGb = grid.querySelector<HTMLElement>("[data-ram-gb]");
  const procsHome = procs?.innerHTML ?? "";
  let cpu = 61;
  let meterTimer = 0;
  const setMeter = (m: HTMLElement | null, pct: number) => {
    if (!m) return;
    const v = Math.max(0, Math.min(100, Math.round(pct)));
    const bar = m.querySelector<HTMLElement>(".bar i");
    const num = m.querySelector<HTMLElement>("[data-meter-v]");
    if (bar) bar.style.setProperty("--v", `${v}%`);
    if (num) num.textContent = String(v);
    m.classList.toggle("is-hot", v >= 80);
  };
  const liveProcs = () => [...(procs?.querySelectorAll<HTMLElement>(".proc:not(.is-dead)") ?? [])];
  const ramUsed = () => RAM_BASE_GB + liveProcs().reduce((n, p) => n + Number(p.dataset.gb ?? 0), 0);
  const cpuFloor = () => 6 + liveProcs().reduce((n, p) => n + Number(p.dataset.cpu ?? 0), 0);
  const paintRam = () => {
    const used = ramUsed();
    setMeter(ramMeter, (used / RAM_TOTAL_GB) * 100);
    if (ramGb) ramGb.textContent = `${used.toFixed(1)} / ${RAM_TOTAL_GB} GB`;
  };
  const loadMeter = grid.querySelector<HTMLElement>('[data-meter="load"]');
  const paintLoad = () => {
    if (!loadMeter) return;
    const load = (cpu / 100) * 8;
    const bar = loadMeter.querySelector<HTMLElement>(".bar i");
    const num = loadMeter.querySelector<HTMLElement>("[data-meter-v]");
    if (bar) bar.style.setProperty("--v", `${Math.round(cpu)}%`);
    if (num) num.textContent = load.toFixed(1);
  };
  const tick = () => {
    const floor = cpuFloor();
    cpu = Math.max(floor - 4, Math.min(floor + 9, cpu + (Math.random() * 8 - 4)));
    setMeter(cpuMeter, cpu);
    paintLoad();
    if (clock) {
      const d = new Date();
      clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  };
  const meterStop = () => window.clearInterval(meterTimer);
  const meterPlay = () => {
    meterStop();
    if (reduced) return;
    meterTimer = window.setInterval(tick, METER_PERIOD_MS);
  };
  const note = (text: string) => {
    if (!log) return;
    const li = document.createElement("li");
    li.textContent = text;
    log.prepend(li);
    while (log.children.length > 3) log.lastElementChild?.remove();
  };
  const bindKills = () => {
    procs?.querySelectorAll<HTMLButtonElement>("[data-kill]").forEach((b) => {
      b.addEventListener("click", () => {
        const row = b.closest<HTMLElement>(".proc");
        if (!row || row.classList.contains("is-dead")) return;
        row.classList.add("is-dead");
        const gb = Number(row.dataset.gb ?? 0).toFixed(1);
        paintRam();
        cpu = Math.max(cpuFloor(), cpu - Number(row.dataset.cpu ?? 0));
        setMeter(cpuMeter, cpu);
        paintLoad();
        note(`killed ${row.dataset.proc} · freed ${gb} GB`);
        if (restore) restore.hidden = false;
        window.setTimeout(() => row.remove(), reduced ? 0 : 420);
        if (liveProcs().length === 0) note("nothing left to kill. the box is still up.");
      });
    });
  };
  bindKills();
  restore?.addEventListener("click", () => {
    if (!procs) return;
    procs.innerHTML = procsHome;
    bindKills();
    paintRam();
    cpu = 61;
    setMeter(cpuMeter, cpu);
    paintLoad();
    note("restored · agents back on the box");
    restore.hidden = true;
  });
  if (procs) {
    const panel = procs.closest<HTMLElement>(".console-panel");
    panel?.addEventListener("mouseenter", meterStop);
    panel?.addEventListener("mouseleave", meterPlay);
  }

  const routeNote = grid.querySelector<HTMLElement>("[data-route-note]");
  const routes = [...grid.querySelectorAll<HTMLButtonElement>("[data-route]")];
  const ROUTE_NOTES: Record<string, string> = {
    auto: "cheapest token that still finishes",
    seat: "one seat, your key, your bill",
  };
  routes.forEach((r) => r.addEventListener("click", () => {
    routes.forEach((o) => {
      const on = o === r;
      o.classList.toggle("is-on", on);
      o.setAttribute("aria-checked", on ? "true" : "false");
    });
    if (routeNote) routeNote.textContent = ROUTE_NOTES[r.dataset.route ?? ""] ?? "";
  }));
  const TOGGLE_NOTES: Record<string, [string, string]> = {
    proxy: ["off · <code>maxq proxy on</code>", "on · CONNECT only · <code>maxq proxy off</code>"],
    intercept: ["false · the CA is documented, not auto-trusted", "false · needs the CA on the box. not from here."],
  };
  grid.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach((t) => {
    const key = t.dataset.toggle ?? "";
    const noteEl = grid.querySelector<HTMLElement>(`[data-toggle-note="${key}"]`);
    t.addEventListener("click", () => {
      if (t.classList.contains("is-locked")) {
        t.classList.remove("is-shake");
        void t.offsetWidth;
        t.classList.add("is-shake");
        if (noteEl) noteEl.innerHTML = TOGGLE_NOTES[key]?.[1] ?? "";
        return;
      }
      const on = t.getAttribute("aria-checked") !== "true";
      t.setAttribute("aria-checked", on ? "true" : "false");
      if (noteEl) noteEl.innerHTML = TOGGLE_NOTES[key]?.[on ? 1 : 0] ?? "";
    });
  });
  const skill = grid.querySelector<HTMLButtonElement>("[data-skill]");
  const skillNote = grid.querySelector<HTMLElement>("[data-skill-note]");
  skill?.addEventListener("click", () => {
    if (skill.classList.contains("is-done")) return;
    skill.classList.add("is-busy");
    skill.textContent = "installing…";
    window.setTimeout(() => {
      skill.classList.remove("is-busy");
      skill.classList.add("is-done");
      skill.textContent = "computer-use ✓";
      if (skillNote) skillNote.textContent = "the bot reads it next task. no restart.";
    }, reduced ? 0 : 900);
  });

  const start = () => {
    grid.classList.add("is-live");
    showTile(cur);
    paintRam();
    tick();
    sheetPlay();
    meterPlay();
  };
  if (reduced) { start(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      start();
      io.disconnect();
    }
  }, { threshold: 0.2 });
  io.observe(grid);
}

let drawn: Route | null = null;
function draw() {
  const app = document.getElementById("app");
  if (!app) return;
  const route = parseRoute();
  if (route !== drawn) {
    drawn = route;
    app.innerHTML = shell(routes[route].draw(), route);
    bindCopy(app);
    bindTabs(app);
    bindCarousel(app);
    bindLaunch(app);
    bindDesk(app);
    bindConsole(app);
    bindNav(app);
    bindReveal(app);
    app.querySelectorAll<HTMLAnchorElement>("[data-section]").forEach(link => link.addEventListener("click", e => {
      const section = document.getElementById(link.dataset.section!);
      if (!section) return;
      e.preventDefault();
      section.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      section.tabIndex = -1;
      section.focus({ preventScroll: true });
    }));
    document.title = `${route === "home" ? "MaxQ" : routes[route].label[0].toUpperCase() + routes[route].label.slice(1)} · Constellation`;
  }
  document.querySelector("[data-topbar]")?.classList.remove("is-open");
  const id = (location.hash || "").replace("#", "");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (id && id !== "home" && document.getElementById(id)) {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  } else if (route !== "home") {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }
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
