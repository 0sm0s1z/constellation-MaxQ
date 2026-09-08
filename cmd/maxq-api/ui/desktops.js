"use strict";

const state = {
  data: null,
  mode: "global",
  page: 0,
  selected: 1,
  visibleCount: 4,
  filter: "live",
  screenSelection: [],
  lastSwitch: "—",
  refreshTimer: null,
  actions: [],
  activeRun: null,
  pendingConfirm: null, // { kind: "action"|"suspend", id, label, expires }
  confirmTimer: null,
};

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error("missing #" + id);
  return el;
};

async function fetchDesktops() {
  const bust = Date.now();
  const r = await fetch(`/desktops?_=${bust}`, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!r.ok) throw new Error("desktops " + r.status);
  return r.json();
}

async function savePreferences(partial = {}) {
  const body = {
    visible_count: state.visibleCount,
    filter: state.filter,
    selected: [],
    ...partial,
  };
  const r = await fetch("/desktops/preferences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("preference " + r.status);
  return r.json();
}

function viewerURL(d, opts) {
  // Each desk has its own websockify port (6080+(n-1)). There is no shared
  // token gateway — appending path=websockify?token=N breaks every desk except
  // :1 (which historically skipped the token path). Keep default WS path.
  const host = window.location.hostname || "127.0.0.1";
  const page = opts && opts.lite ? "vnc_lite.html" : "vnc.html";
  const port = Number(d.viewer_port);
  if (!Number.isFinite(port) || port < 1) return "";
  return `http://${host}:${port}/${page}?autoconnect=true&resize=scale`;
}

function fmtPct(v) {
  return Number.isFinite(v) ? `${Math.round(v)}%` : "—";
}

function fmtLoad(v) {
  return Number.isFinite(v) ? Number(v).toFixed(2) : "—";
}

function fmtGiB(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  return (n / (1024 ** 3)).toFixed(1);
}

function fmtUptime(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return "—";
  const s = Math.floor(n);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function setTextOpt(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function liveDesktop(number) {
  return state.data?.desktops.find((d) => d.number === number) || null;
}

function filteredDesktops() {
  if (!state.data) return [];
  let items = state.data.desktops.slice();
  if (state.filter === "live") items = items.filter((d) => d.live);
  else if (state.filter === "ready") items = items.filter((d) => d.viewer_ok);
  else if (state.filter === "idle") items = items.filter((d) => !d.live);
  else if (state.filter === "paused") items = items.filter((d) => d.suspended);
  // Live/ready: awake desks first so Visible=4 isn't a wall of frozen cards.
  if (state.filter === "live" || state.filter === "ready" || state.filter === "all") {
    items.sort((a, b) => Number(!!a.suspended) - Number(!!b.suspended) || a.number - b.number);
  }
  return items;
}

function pickCrewDesktop(preferred) {
  if (!state.data) return null;
  const filtered = filteredDesktops();
  const ready = filtered.filter((d) => d.viewer_ok);
  if (preferred) {
    const pref = liveDesktop(preferred);
    if (pref && pref.viewer_ok && (!filtered.length || filtered.some((x) => x.number === preferred))) {
      return pref;
    }
  }
  if (ready.length) return ready[0];
  if (preferred) {
    const pref = liveDesktop(preferred);
    if (pref && (!filtered.length || filtered.some((x) => x.number === preferred))) return pref;
  }
  return filtered[0] || state.data.desktops[0] || null;
}

function totalPages() {
  return Math.max(1, Math.ceil(filteredDesktops().length / state.visibleCount));
}

function clampPage() {
  state.page = Math.max(0, Math.min(state.page, totalPages() - 1));
}

function setText(id, text) {
  $(id).textContent = text;
}

function bustViewerSigs() {
  const grid = document.getElementById("desktop-grid");
  if (grid) delete grid.dataset.sig;
  const viewer = document.getElementById("crew-viewer");
  if (viewer) delete viewer.dataset.sig;
}


function parseCrewDeepLink() {
  const params = new URLSearchParams(location.search);
  let n = Number(params.get("crew"));
  if (!Number.isInteger(n) || n < 1) {
    const hash = (location.hash || "").replace(/^#/, "");
    const m = hash.match(/^crew[=:]?(\d+)$/i) || hash.match(/^(\d+)$/);
    if (m) n = Number(m[1]);
  }
  return Number.isInteger(n) && n >= 1 ? n : 0;
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
  if (mode === "crew") {
    const pick = pickCrewDesktop(state.selected);
    if (pick) state.selected = pick.number;
    renderCrew();
  } else renderGlobal();
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
  if (d.live && d.activity === "busy") badges.push('<span class="busy">busy</span>');
  else if (d.live && d.activity === "quiet") badges.push('<span class="quiet">quiet</span>');
  if (d.live && d.viewer_ok) badges.push('<span class="novnc">noVNC</span>');
  else if (d.live && !d.viewer_ok) badges.push('<span class="novnc-off">no viewer</span>');
  if (d.suspended) badges.push('<span class="paused">frozen</span>');
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
  // SIGSTOP desks keep websockify up but RFB dies → noVNC "connection is closed".
  // Show an honest frozen card instead of a broken iframe.
  if (d.suspended) {
    const frozen = document.createElement("div");
    frozen.className = "idle-screen viewer-frozen";
    frozen.innerHTML = `<div class="idle-mark"><strong>:${d.number}</strong><span>frozen · SIGSTOP</span><span>Wake from Crew / Resume paused</span></div>`;
    return frozen;
  }
  if (!d.viewer_ok) {
    const offline = document.createElement("div");
    offline.className = "idle-screen viewer-offline";
    offline.innerHTML = `<div class="idle-mark"><strong>:${d.number}</strong><span>X11 live · noVNC offline</span><span>port ${d.viewer_port}</span></div>`;
    return offline;
  }
  const url = viewerURL(d, { lite: !crew });
  if (!url) {
    const bad = document.createElement("div");
    bad.className = "idle-screen viewer-offline";
    bad.innerHTML = `<div class="idle-mark"><strong>:${d.number}</strong><span>viewer port missing</span></div>`;
    return bad;
  }
  const frame = document.createElement("iframe");
  frame.src = url;
  frame.title = `Desktop :${d.number}`;
  frame.loading = crew ? "eager" : "lazy";
  frame.allow = "clipboard-read; clipboard-write";
  frame.referrerPolicy = "no-referrer";
  if (crew) frame.setAttribute("allowfullscreen", "");
  return frame;
}

function renderGlobal() {
  if (!state.data || state.mode !== "global") return;
  clampPage();
  const grid = $("desktop-grid");
  const items = filteredDesktops();
  const start = state.page * state.visibleCount;
  const pageItems = items.slice(start, start + state.visibleCount);
  const sig = `${state.page}:${state.visibleCount}:${state.filter}:` + pageItems.map((d) => `${d.number}:${d.live ? 1 : 0}:${d.viewer_ok ? 1 : 0}:${d.current ? 1 : 0}:${d.suspended ? 1 : 0}`).join(",");
  if (grid.dataset.sig === sig) { renderStrip(); return; }
  grid.dataset.sig = sig;
  grid.replaceChildren();
  grid.dataset.count = String(pageItems.length || 1);

  if (!pageItems.length) {
    const empty = document.createElement("div");
    empty.className = "idle-screen empty-filter";
    empty.innerHTML = `<div class="idle-mark"><strong>No desktops</strong><span>adjust filter or picker</span></div>`;
    grid.appendChild(empty);
  } else {
    for (const d of pageItems) {
      const tile = document.createElement("article");
      tile.className = `desktop-tile${d.current ? " current" : ""}`;
      tile.dataset.desktop = String(d.number);
      tile.innerHTML = tileMarkup(d);
      tile.appendChild(makeViewer(d));
      tile.addEventListener("click", () => selectDesktop(d.number, true));
      grid.appendChild(tile);
    }
  }
  renderStrip();
}

function fmtAge(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 5) return "now";
  if (n < 60) return `${n}s ago`;
  if (n < 3600) return `${Math.floor(n / 60)}m ago`;
  return `${Math.floor(n / 3600)}h ago`;
}

function desktopActivity(d) {
  if (d.suspended) return "paused";
  if (!d.live) return "idle";
  if (d.activity === "busy" || d.activity === "quiet" || d.activity === "idle" || d.activity === "paused") return d.activity;
  return "quiet";
}

function railClass(d) {
  const act = desktopActivity(d);
  return `rail-button ${act}${d.live ? " live" : ""}${d.viewer_ok ? " ready" : ""}${d.number === state.selected ? " active" : ""}`;
}

function railTitle(d) {
  const act = desktopActivity(d);
  const bits = [`:${d.number}`, d.live ? "live" : "idle", act];
  if (d.current) bits.push("current");
  const age = fmtAge(d.activity_age_s);
  if (act === "quiet" && age) bits.push(age);
  if (act === "busy") bits.push("moving");
  if (d.suspended) bits.push("suspended");
  return bits.join(" · ");
}

function paintRailButton(b, d) {
  b.className = railClass(d);
  b.title = railTitle(d);
}

function renderCrewRail() {
  if (!state.data) return;
  const rail = $("crew-rail");
  const items = filteredDesktops();
  const list = items.length ? items : state.data.desktops;
  const sig = list.map((d) => d.number).join(",");
  if (rail.dataset.sig === sig) {
    for (const b of rail.querySelectorAll(".rail-button")) {
      const n = Number(b.dataset.desktop);
      const d = list.find((x) => x.number === n);
      if (d) paintRailButton(b, d);
    }
    return;
  }
  rail.dataset.sig = sig;
  rail.replaceChildren();
  for (const d of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.desktop = String(d.number);
    b.innerHTML = `<span class="rail-label">:${d.number}</span><span class="pip" aria-hidden="true"></span>`;
    paintRailButton(b, d);
    b.addEventListener("click", () => selectDesktop(d.number));
    rail.appendChild(b);
  }
}

function renderCrew() {
  if (!state.data || state.mode !== "crew") return;
  let d = pickCrewDesktop(state.selected);
  if (!d) return;
  state.selected = d.number;
  renderCrewRail();
  setText("crew-title", `:${d.number}`);
  setText("crew-panel-title", `Desktop :${d.number}`);
  const statusBits = [];
  if (d.live) statusBits.push(d.current ? "live · current" : "live");
  else statusBits.push("idle");
  if (d.viewer_ok) statusBits.push("noVNC");
  else if (d.live) statusBits.push("no viewer");
  setText("crew-status", statusBits.join(" · "));
  $("crew-status").style.color = d.viewer_ok ? "var(--green)" : (d.live ? "var(--peach)" : "var(--overlay1)");
  const viewer = $("crew-viewer");
  const sig = `${d.number}:${d.live ? 1 : 0}:${d.viewer_ok ? 1 : 0}:${d.suspended ? 1 : 0}`;
  if (viewer.dataset.sig !== sig) {
    viewer.dataset.sig = sig;
    viewer.replaceChildren(makeViewer(d, true));
  }
  const url = viewerURL(d);
  setText("crew-url", url);
  setText("crew-viewer-port", String(d.viewer_port));
  setText("crew-vnc-port", String(d.vnc_port));
  setText("crew-live", d.suspended ? "suspended" : (d.live ? "live" : "idle"));
  setText("crew-current", d.current ? "yes" : "no");
  renderCrewChat(d);
  renderCrewTelemetry();
  syncSuspendButtons(d);
  renderStreamActions();
}

function renderCrewChat(d) {
  const list = document.getElementById("crew-chat-list");
  const count = document.getElementById("crew-chat-count");
  if (!list || !count) return;
  const chats = Array.isArray(d.chats) ? d.chats : [];
  count.textContent = chats.length ? `${chats.length} live` : "none";
  list.replaceChildren();
  if (!chats.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.textContent = d.live
      ? "No chatgpt / grok session on this desktop."
      : "Desktop idle.";
    list.appendChild(empty);
    return;
  }
  for (const chat of chats) {
    const el = document.createElement("article");
    el.className = "chat-thread";
    const site = document.createElement("span");
    site.className = "chat-site";
    site.textContent = chat.site || "chat";
    const title = document.createElement("span");
    title.className = "chat-title";
    title.textContent = chat.title || chat.site || "untitled";
    const url = document.createElement("span");
    url.className = "chat-url";
    url.textContent = chat.url || "";
    el.append(site, title, url);
    list.appendChild(el);
  }
}

function renderCrewTelemetry() {
  if (!state.data) return;
  const s = state.data.system;
  const cores = Number.isFinite(s.cpu_cores) && s.cpu_cores > 0 ? s.cpu_cores : null;
  const ramAmt = (Number.isFinite(s.ram_used_bytes) && Number.isFinite(s.ram_total_bytes) && s.ram_total_bytes > 0)
    ? `${fmtGiB(s.ram_used_bytes)} / ${fmtGiB(s.ram_total_bytes)} GiB`
    : null;
  setText("crew-cpu", cores ? `${fmtPct(s.cpu_percent)} · ${cores} cores` : fmtPct(s.cpu_percent));
  setText("crew-ram", ramAmt ? `${fmtPct(s.ram_percent)} · ${ramAmt}` : fmtPct(s.ram_percent));
  setText("crew-load", fmtLoad(s.load1));
  setText("crew-gost", s.gost_running ? "running" : "stopped");
}

function renderTelemetry() {
  if (!state.data) return;
  const s = state.data.system;
  const current = state.data.desktops.find((d) => d.current);
  const filtered = filteredDesktops();
  const pageStart = state.page * state.visibleCount;
  const pageSlice = filtered.slice(pageStart, pageStart + state.visibleCount);
  const readyOnPage = pageSlice.filter((d) => d.viewer_ok).length;
  const readyTotal = state.data.desktops.filter((d) => d.viewer_ok).length;
  const viewerCount = state.mode === "crew"
    ? (liveDesktop(state.selected)?.viewer_ok ? 1 : 0)
    : readyOnPage;
  const cores = Number.isFinite(s.cpu_cores) && s.cpu_cores > 0 ? s.cpu_cores : null;
  setText("metric-cpu", fmtPct(s.cpu_percent));
  setText("metric-ram", fmtPct(s.ram_percent));
  setText("metric-load", fmtLoad(s.load1));
  setText("metric-gost", s.gost_running ? "running" : "stopped");
  const ramCard = document.querySelector("article.metric-ram");
  if (ramCard) ramCard.classList.toggle("pressure", Number.isFinite(s.ram_percent) && s.ram_percent >= 85);
  setTextOpt("metric-cpu-detail", cores ? `${cores} cores` : "");
  setTextOpt("metric-ram-detail",
    (Number.isFinite(s.ram_used_bytes) && Number.isFinite(s.ram_total_bytes) && s.ram_total_bytes > 0)
      ? `${fmtGiB(s.ram_used_bytes)} / ${fmtGiB(s.ram_total_bytes)} GiB`
      : "");
  setTextOpt("metric-load-detail", cores ? `on ${cores} cores` : "");
  setTextOpt("metric-gost-detail", s.gost_running ? "proxy" : "");
  setText("metric-state", s.state || "—");
  setText("metric-display", s.agent_display || "—");
  setText("metric-current", current ? `:${current.number}` : "—");
  setText("metric-switch", state.lastSwitch);
  setText("metric-live", `${s.live_count} / ${state.data.desktops.length}`);
  setText("metric-viewers", `${viewerCount} · ${readyTotal} ready`);
  setTextOpt("sys-cpu-model", s.cpu_model || "—");
  setTextOpt("sys-cores", cores ? `${cores} logical` : "—");
  setTextOpt("sys-hostname", s.hostname || "—");
  setTextOpt("sys-kernel", s.kernel || "—");
  setTextOpt("sys-uptime", fmtUptime(s.uptime_seconds));
  setText("top-live", `${s.live_count} live`);
  setText("top-display", `display ${s.agent_display || "—"}`);
  setText("telemetry-time", new Date(s.generated_at_utc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  const ready = Number.isFinite(s.viewer_ready) ? s.viewer_ready : readyTotal;
  let activity = current
    ? `Current agent is on :${current.number}. ${s.live_count} X11 live · ${ready} noVNC ready.`
    : `${s.live_count} X11 live · ${ready} noVNC ready.`;
  if (Number.isFinite(s.ram_percent) && s.ram_percent >= 85) {
    activity += ` RAM pressure ${Math.round(s.ram_percent)}% — Clear RAM is on STREAM.`;
  }
  setText("activity-copy", activity);
  renderCrewTelemetry();
}

function renderFilterChips() {
  for (const btn of $("filter-chips").querySelectorAll("[data-filter]")) {
    btn.classList.toggle("active", btn.dataset.filter === state.filter);
  }
}

function renderJumpSelect() {
  const sel = document.getElementById("jump-desktop");
  if (!sel || !state.data) return;
  const known = state.data.desktops;
  const sig = known.map((d) => `${d.number}:${d.live ? 1 : 0}`).join(",");
  if (sel.dataset.sig !== sig) {
    sel.dataset.sig = sig;
    const current = sel.value;
    sel.replaceChildren();
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All";
    sel.appendChild(all);
    for (const d of known) {
      const o = document.createElement("option");
      o.value = String(d.number);
      o.textContent = `:${d.number}` + (d.live ? " live" : " idle") + (d.viewer_ok ? " · vnc" : "") + (d.current ? " · current" : "");
      sel.appendChild(o);
    }
    if ([...sel.options].some((o) => o.value === current)) sel.value = current;
  }
}

function jumpToDesktop(n) {
  if (!n) {
    if (state.mode === "global") renderGlobal();
    else renderCrew();
    renderStrip();
    return;
  }
  const items = filteredDesktops();
  let idx = items.findIndex((d) => d.number === n);
  if (idx < 0) {
    state.filter = "all";
    renderFilterChips();
    idx = filteredDesktops().findIndex((d) => d.number === n);
  }
  if (idx < 0) return;
  state.selected = n;
  state.page = Math.floor(idx / state.visibleCount);
  state.lastSwitch = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (state.mode === "crew") renderCrew();
  else renderGlobal();
  renderTelemetry();
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
  renderFilterChips();
  renderJumpSelect();
}

function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 1800);
}


function actionBinds(a, surface) {
  return Array.isArray(a.binds) && a.binds.some((b) => b === surface || b.startsWith(surface + "."));
}

function clearPendingConfirm() {
  state.pendingConfirm = null;
  if (state.confirmTimer) {
    clearTimeout(state.confirmTimer);
    state.confirmTimer = null;
  }
}

function armConfirm(kind, id, label) {
  clearPendingConfirm();
  state.pendingConfirm = { kind, id, label, expires: Date.now() + 6000 };
  state.confirmTimer = setTimeout(() => {
    clearPendingConfirm();
    renderStreamActions();
    const d = liveDesktop(state.selected);
    if (d) syncSuspendButtons(d);
  }, 6000);
}

function confirmArmed(kind, id) {
  const p = state.pendingConfirm;
  return !!(p && p.kind === kind && p.id === id && p.expires > Date.now());
}

function renderActionButton(a) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "action-btn";
  b.dataset.action = a.id;
  const running = state.activeRun && state.activeRun.action_id === a.id && (state.activeRun.state === "queued" || state.activeRun.state === "running");
  if (!a.armed) {
    b.disabled = true;
    b.classList.add("unarmed");
    b.textContent = `${a.label} · unarmed`;
    b.title = a.description || "Catalogued but not armed — webhook URL required";
  } else if (running) {
    b.disabled = true;
    b.classList.add("busy");
    b.textContent = "Running…";
    b.title = a.description || a.label;
  } else if (confirmArmed("action", a.id)) {
    b.classList.add("confirm-armed");
    if (a.id === "resume-paused") {
      const n = Number(state.data && state.data.system && state.data.system.suspended_count);
      b.textContent = Number.isFinite(n) && n > 0
        ? `Confirm resume ${n} frozen?`
        : "Confirm resume frozen?";
    } else {
      b.textContent = `Confirm ${a.label}?`;
    }
    b.title = "Click again within 6s to run. Escape cancels.";
  } else {
    b.textContent = a.label;
    b.title = (a.description || a.label) + " — requires confirm";
  }
  return b;
}

function renderActionRuns() {
  const host = document.getElementById("action-runs");
  if (!host) return;
  host.replaceChildren();
  const run = state.activeRun;
  if (!run) return;
  const card = document.createElement("div");
  card.className = "action-run-card";
  const head = document.createElement("div");
  head.className = "run-head";
  const label = document.createElement("span");
  label.className = "run-label";
  label.textContent = run.label || run.action_id || "Action";
  const st = document.createElement("span");
  st.className = "run-state " + (run.state || "");
  st.textContent = run.state || "…";
  head.append(label, st);
  const detail = document.createElement("div");
  detail.className = "run-detail";
  detail.textContent = run.detail || "";
  card.append(head, detail);
  host.appendChild(card);
}

function renderStreamActions() {
  const ram = document.getElementById("stream-actions-ram");
  const extra = document.getElementById("stream-actions");
  const crew = document.getElementById("crew-stream-actions");
  if (ram) ram.replaceChildren();
  if (extra) extra.replaceChildren();
  if (crew) crew.replaceChildren();
  for (const a of state.actions) {
    if (actionBinds(a, "stream.ram") && ram) ram.appendChild(renderActionButton(a));
    else if (actionBinds(a, "stream") && extra) extra.appendChild(renderActionButton(a));
    if (crew && (actionBinds(a, "crew.desktop") || actionBinds(a, "stream"))) {
      crew.appendChild(renderActionButton(a));
    }
  }
  renderActionRuns();
}

function syncSuspendButtons(d) {
  const sus = document.getElementById("suspend-desktop");
  const res = document.getElementById("resume-desktop");
  const hint = document.getElementById("crew-control-hint");
  if (!sus || !res) return;
  const locked = !d || d.current || d.number < 2;
  const pending = confirmArmed("suspend", String(d?.number || ""));
  sus.disabled = locked || !!d?.suspended;
  res.disabled = locked || !d?.suspended;
  if (pending && !locked && d && !d.suspended) {
    sus.textContent = `Confirm freeze :${d.number}?`;
    sus.classList.add("danger-armed");
    sus.title = "Click again to SIGSTOP. Does not wipe or kill.";
  } else {
    sus.textContent = "Freeze · SIGSTOP";
    sus.classList.remove("danger-armed");
    sus.title = locked
      ? "Won't freeze the current or primary desktop"
      : "Freeze this desktop (SIGSTOP). Does not wipe or kill.";
  }
  res.textContent = "Wake · SIGCONT";
  res.title = "Wake this desktop (SIGCONT)";
  if (hint) {
    hint.textContent = locked
      ? "Primary/current desktop is locked — freeze/wake disabled."
      : (d?.suspended
        ? `:${d.number} is frozen (SIGSTOP). Wake restores processes — this is not a wipe.`
        : "Freeze pauses processes — it is not a wipe or stop-window.");
  }
}

async function controlDesktop(n, op) {
  const r = await fetch(`/desktops/${encodeURIComponent(n)}/${op}`, { method: "POST" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || op + " failed");
  return data;
}

async function loadActions() {
  try {
    const r = await fetch("/actions", { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    state.actions = Array.isArray(data.actions) ? data.actions : [];
    renderStreamActions();
  } catch (_) { /* catalog optional */ }
}

async function runAction(id, btn) {
  const action = state.actions.find((a) => a.id === id);
  if (!action) {
    toast("unknown action");
    return;
  }
  if (!action.armed) {
    toast(`${action.label} is unarmed`);
    renderStreamActions();
    return;
  }
  if (!confirmArmed("action", id)) {
    armConfirm("action", id, action.label);
    renderStreamActions();
    if (id === "resume-paused") {
      const n = Number(state.data && state.data.system && state.data.system.suspended_count);
      toast(Number.isFinite(n) && n > 0 ? `Confirm resume ${n} frozen?` : "Confirm resume frozen?");
    } else {
      toast(`Confirm ${action.label}?`);
    }
    return;
  }
  clearPendingConfirm();
  if (btn) btn.disabled = true;
  try {
    const r = await fetch(`/actions/${encodeURIComponent(id)}/run`, { method: "POST" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast(data.error || "action failed");
      renderStreamActions();
      return;
    }
    state.activeRun = data.run || { id: "?", action_id: id, label: action.label, state: "queued", detail: "started" };
    toast(`${state.activeRun.label || id} started`);
    setTextOpt("activity-copy", `${state.activeRun.label || id}: ${state.activeRun.detail || "running"}`);
    renderStreamActions();
    if (state.activeRun.id && state.activeRun.id !== "?") pollActionRun(state.activeRun.id);
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e));
    renderStreamActions();
  }
}

async function pollActionRun(id) {
  for (let i = 0; i < 60; i++) {
    await new Promise((res) => setTimeout(res, 2000));
    try {
      const r = await fetch(`/actions/runs/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!r.ok) break;
      const data = await r.json();
      const run = data.run;
      if (!run) break;
      state.activeRun = run;
      setTextOpt("activity-copy", `${run.label}: ${run.state} · ${run.detail || ""}`);
      if (run.state === "ok" || run.state === "error") {
        toast(`${run.label} ${run.state}`);
        renderStreamActions();
        return;
      }
      renderStreamActions(); // keep run card live without crashing UI
    } catch (_) { break; }
  }
  renderStreamActions();
}

async function refresh({ initial = false, hard = false } = {}) {
  try {
    if (hard) bustViewerSigs();
    const data = await fetchDesktops();
    state.data = data;
    if (initial) {
      state.visibleCount = data.preference?.visible_count || 4;
      state.filter = data.preference?.filter || "live";
      {
        const fp = new URLSearchParams(location.search).get("filter");
        if (fp && ["all", "live", "idle", "ready", "paused"].includes(fp)) state.filter = fp;
      }
      state.screenSelection = [];
      const current = data.desktops.find((d) => d.current);
      if (current) state.selected = current.number;
      else if (data.desktops[0]) state.selected = data.desktops[0].number;
      let pageItems = data.desktops.slice();
      if (state.filter === "live") pageItems = pageItems.filter((d) => d.live);
      else if (state.filter === "ready") pageItems = pageItems.filter((d) => d.viewer_ok);
      else if (state.filter === "idle") pageItems = pageItems.filter((d) => !d.live);
      else if (state.filter === "paused") pageItems = pageItems.filter((d) => d.suspended);
      const idx = pageItems.findIndex((d) => d.number === state.selected);
      if (idx >= 0) state.page = Math.floor(idx / state.visibleCount);
    }
    clampPage();
    renderTelemetry();
    if (state.mode === "global") renderGlobal();
    else renderCrew();
    renderStrip();
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
    if (!Number.isInteger(n) || n < 1 || n > 9) return;
    state.visibleCount = n;
    state.page = 0;
    renderGlobal();
    renderTelemetry();
    try { await savePreferences({ visible_count: n }); toast(`Visible desktops set to ${n}`); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  });
  $("jump-desktop").addEventListener("change", (event) => {
    const raw = event.target.value;
    if (!raw) {
      jumpToDesktop(0);
      return;
    }
    const n = Number(raw);
    if (!Number.isInteger(n)) return;
    jumpToDesktop(n);
  });
  $("filter-chips").addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-filter]");
    if (!btn) return;
    const next = btn.dataset.filter;
    if (!["all", "live", "idle", "ready", "paused"].includes(next) || next === state.filter) return;
    state.filter = next;
    state.page = 0;
    renderFilterChips();
    if (state.mode === "global") renderGlobal();
    else renderCrew();
    renderTelemetry();
    try { await savePreferences({ filter: next }); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  });
  $("refresh-desktops").addEventListener("click", async () => {
    await refresh({ hard: true });
    toast("Desktops refreshed");
  });
  document.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn || btn.disabled) return;
    const id = btn.dataset.action;
    if (id) runAction(id, btn);
  });
  $("open-viewer").addEventListener("click", () => {
    const d = liveDesktop(state.selected);
    if (!d) return;
    if (!d.viewer_ok) { toast(`noVNC offline on :${d.number} (port ${d.viewer_port})`); return; }
    window.open(viewerURL(d), "_blank", "noopener,noreferrer");
  });
  $("copy-viewer").addEventListener("click", async () => {
    const d = liveDesktop(state.selected);
    if (!d) return;
    if (!d.viewer_ok) { toast(`noVNC offline on :${d.number}`); return; }
    try { await navigator.clipboard.writeText(viewerURL(d)); toast("Viewer URL copied"); }
    catch (_) { toast("Clipboard blocked"); }
  });
  $("suspend-desktop").addEventListener("click", async () => {
    const d = liveDesktop(state.selected);
    if (!d) return;
    if (!confirmArmed("suspend", String(d.number))) {
      armConfirm("suspend", String(d.number), `freeze :${d.number}`);
      syncSuspendButtons(d);
      toast(`Confirm freeze :${d.number}? (SIGSTOP, not a wipe)`);
      return;
    }
    clearPendingConfirm();
    try {
      await controlDesktop(d.number, "suspend");
      toast(`:${d.number} frozen (SIGSTOP)`);
      await refresh();
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  });
  $("resume-desktop").addEventListener("click", async () => {
    const d = liveDesktop(state.selected);
    if (!d) return;
    clearPendingConfirm();
    try {
      await controlDesktop(d.number, "resume");
      toast(`:${d.number} awake (SIGCONT)`);
      await refresh();
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.pendingConfirm) return;
    clearPendingConfirm();
    renderStreamActions();
    const d = liveDesktop(state.selected);
    if (d) syncSuspendButtons(d);
    toast("Confirm cancelled");
  });

  await loadActions();
  await refresh({ initial: true });
  const crewN = parseCrewDeepLink();
  if (crewN) {
    selectDesktop(crewN, true);
  } else {
    setMode("global");
  }
  state.refreshTimer = setInterval(() => refresh(), 3000);
});

window.addEventListener("beforeunload", () => {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
});
