"use strict";

const state = {
  data: null,
  mode: "global",
  page: 0,
  selected: 1,
  visibleCount: 4,
  lastSwitch: "—",
  refreshTimer: null,
};

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
};

async function fetchDesktops() {
  const r = await fetch("/desktops", { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!r.ok) throw new Error("desktops " + r.status);
  return r.json();
}

async function saveVisibleCount(n) {
  const r = await fetch("/desktops/preferences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ visible_count: n }),
  });
  if (!r.ok) throw new Error("preference " + r.status);
}

function viewerURL(d) {
  const host = window.location.hostname;
  const base = `http://${host}:${d.viewer_port}/vnc.html?autoconnect=true&resize=scale`;
  if (d.number === 1) return base;
  return `${base}&path=${encodeURIComponent(`websockify?token=${d.token}`)}`;
}

function fmtPct(v) {
  return Number.isFinite(v) ? `${Math.round(v)}%` : "—";
}

function fmtLoad(v) {
  return Number.isFinite(v) ? Number(v).toFixed(2) : "—";
}

function liveDesktop(number) {
  return state.data?.desktops.find((d) => d.number === number) || null;
}

function totalPages() {
  return Math.max(1, Math.ceil((state.data?.desktops.length || 15) / state.visibleCount));
}

function clampPage() {
  state.page = Math.max(0, Math.min(state.page, totalPages() - 1));
}

function setText(id, text) {
  $(id).textContent = text;
}

function setMode(mode) {
  if (mode !== "global" && mode !== "crew") return;
  state.mode = mode;
  $("global-view").hidden = mode !== "global";
  $("crew-view").hidden = mode !== "crew";
  $("mode-global").classList.toggle("active", mode === "global");
  $("mode-crew").classList.toggle("active", mode === "crew");
  $("page-prev").disabled = mode === "crew" || state.page <= 0;
  $("page-next").disabled = mode === "crew" || state.page >= totalPages() - 1;
  if (mode === "crew") renderCrew();
  else renderGlobal();
  renderStrip();
}

function selectDesktop(number, enterCrew = false) {
  if (!liveDesktop(number)) return;
  state.selected = number;
  state.lastSwitch = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (enterCrew) setMode("crew");
  else if (state.mode === "crew") renderCrew();
  renderTelemetry();
}

function tileMarkup(d) {
  const badges = [d.live ? '<span class="live">live</span>' : '<span class="idle">idle</span>'];
  if (d.current) badges.push('<span class="current">current</span>');
  return `<div class="tile-head"><span class="tile-label">:${d.number}</span><span class="tile-badges">${badges.join("")}</span></div>`;
}

function makeViewer(d, crew = false) {
  if (!d.live) {
    const idle = document.createElement("div");
    idle.className = "idle-screen";
    idle.innerHTML = `<div class="idle-mark"><strong>:${d.number}</strong><span>desktop idle</span></div>`;
    return idle;
  }
  const frame = document.createElement("iframe");
  frame.src = viewerURL(d);
  frame.title = `Desktop :${d.number}`;
  frame.loading = "eager";
  frame.allow = "clipboard-read; clipboard-write";
  frame.referrerPolicy = "no-referrer";
  if (crew) frame.setAttribute("allowfullscreen", "");
  return frame;
}

function renderGlobal() {
  if (!state.data || state.mode !== "global") return;
  clampPage();
  const grid = $("desktop-grid");
  grid.replaceChildren();
  const start = state.page * state.visibleCount;
  const pageItems = state.data.desktops.slice(start, start + state.visibleCount);
  grid.dataset.count = String(pageItems.length);

  for (const d of pageItems) {
    const tile = document.createElement("article");
    tile.className = `desktop-tile${d.current ? " current" : ""}`;
    tile.dataset.desktop = String(d.number);
    tile.innerHTML = tileMarkup(d);
    tile.appendChild(makeViewer(d));
    tile.addEventListener("click", () => selectDesktop(d.number, true));
    grid.appendChild(tile);
  }
  renderStrip();
}

function renderCrewRail() {
  if (!state.data) return;
  const rail = $("crew-rail");
  rail.replaceChildren();
  for (const d of state.data.desktops) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `rail-button${d.number === state.selected ? " active" : ""}${d.live ? " live" : ""}`;
    b.textContent = `:${d.number}`;
    b.title = `${d.display} · ${d.live ? "live" : "idle"}${d.current ? " · current" : ""}`;
    b.addEventListener("click", () => selectDesktop(d.number));
    rail.appendChild(b);
  }
}

function renderCrew() {
  if (!state.data || state.mode !== "crew") return;
  const d = liveDesktop(state.selected) || state.data.desktops[0];
  if (!d) return;
  state.selected = d.number;
  renderCrewRail();
  setText("crew-title", `:${d.number}`);
  setText("crew-panel-title", `Desktop :${d.number}`);
  setText("crew-status", d.live ? (d.current ? "live · current" : "live") : "idle");
  $("crew-status").style.color = d.live ? "var(--green)" : "var(--overlay1)";
  const viewer = $("crew-viewer");
  viewer.replaceChildren(makeViewer(d, true));
  const url = viewerURL(d);
  setText("crew-url", url);
  setText("crew-viewer-port", String(d.viewer_port));
  setText("crew-vnc-port", String(d.vnc_port));
  setText("crew-live", d.live ? "live" : "idle");
  setText("crew-current", d.current ? "yes" : "no");
  renderCrewTelemetry();
}

function renderCrewTelemetry() {
  if (!state.data) return;
  const s = state.data.system;
  setText("crew-cpu", fmtPct(s.cpu_percent));
  setText("crew-ram", fmtPct(s.ram_percent));
  setText("crew-load", fmtLoad(s.load1));
  setText("crew-gost", s.gost_running ? "running" : "stopped");
}

function renderTelemetry() {
  if (!state.data) return;
  const s = state.data.system;
  const current = state.data.desktops.find((d) => d.current);
  const viewerCount = state.mode === "crew" ? 1 : Math.min(state.visibleCount, state.data.desktops.length - state.page * state.visibleCount);
  setText("metric-cpu", fmtPct(s.cpu_percent));
  setText("metric-ram", fmtPct(s.ram_percent));
  setText("metric-load", fmtLoad(s.load1));
  setText("metric-gost", s.gost_running ? "running" : "stopped");
  setText("metric-state", s.state || "—");
  setText("metric-display", s.agent_display || "—");
  setText("metric-current", current ? `:${current.number}` : "—");
  setText("metric-switch", state.lastSwitch);
  setText("metric-live", `${s.live_count} / ${state.data.desktops.length}`);
  setText("metric-viewers", String(viewerCount));
  setText("top-live", `${s.live_count} live`);
  setText("top-display", `display ${s.agent_display || "—"}`);
  setText("telemetry-time", new Date(s.generated_at_utc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  setText("activity-copy", current ? `Current agent is on :${current.number}. ${s.live_count} desktops are advertising X11 sockets.` : `${s.live_count} desktops are advertising X11 sockets.`);
  renderCrewTelemetry();
}

function renderStrip() {
  clampPage();
  const pages = totalPages();
  const label = `${state.page + 1} / ${pages}`;
  setText("page-label", label);
  setText("strip-page", label);
  $("page-prev").disabled = state.mode === "crew" || state.page <= 0;
  $("page-next").disabled = state.mode === "crew" || state.page >= pages - 1;
  $("visible-count").value = String(state.visibleCount);
}

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 1800);
}

async function refresh({ initial = false } = {}) {
  try {
    const data = await fetchDesktops();
    state.data = data;
    if (initial) {
      state.visibleCount = data.preference?.visible_count || 4;
      const current = data.desktops.find((d) => d.current);
      if (current) state.selected = current.number;
      else if (data.desktops[0]) state.selected = data.desktops[0].number;
    }
    clampPage();
    renderTelemetry();
    if (state.mode === "global") renderGlobal();
    else renderCrew();
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  $("mode-global").addEventListener("click", () => setMode("global"));
  $("mode-crew").addEventListener("click", () => setMode("crew"));
  $("page-prev").addEventListener("click", () => {
    if (state.page > 0) { state.page--; renderGlobal(); renderTelemetry(); }
  });
  $("page-next").addEventListener("click", () => {
    if (state.page < totalPages() - 1) { state.page++; renderGlobal(); renderTelemetry(); }
  });
  $("visible-count").addEventListener("change", async (event) => {
    const n = Number(event.target.value);
    if (!Number.isInteger(n) || n < 1 || n > 6) return;
    state.visibleCount = n;
    state.page = 0;
    renderGlobal();
    renderTelemetry();
    try { await saveVisibleCount(n); toast(`Visible desktops set to ${n}`); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  });
  $("open-viewer").addEventListener("click", () => {
    const d = liveDesktop(state.selected);
    if (d) window.open(viewerURL(d), "_blank", "noopener,noreferrer");
  });
  $("copy-viewer").addEventListener("click", async () => {
    const d = liveDesktop(state.selected);
    if (!d) return;
    try { await navigator.clipboard.writeText(viewerURL(d)); toast("Viewer URL copied"); }
    catch { toast("Clipboard unavailable"); }
  });

  await refresh({ initial: true });
  setMode("global");
  state.refreshTimer = setInterval(() => refresh(), 3000);
});

window.addEventListener("beforeunload", () => {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
});
