"use strict";

let lastHomeStatus = null;


function setDesktopsTileLive(liveCount) {
  const tile = document.querySelector('a.tile[href="/desktops"]');
  const foot = document.getElementById("tile-desktops-foot");
  const live = Number(liveCount) > 0;
  if (tile) tile.classList.toggle("live", live);
  if (foot) foot.classList.toggle("live", live);
}

function setFoot(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function fillTile(id, path, fmt) {
  try {
    const data = await MaxQShell.getJSON(path, "application/json");
    setFoot(id, fmt(data));
  } catch (_) {
    setFoot(id, "unavailable");
  }
}


function fmtGiB(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "—";
  return (n / (1024 ** 3)).toFixed(1);
}


function frozenSeg(sys) {
  const n = sys && Number(sys.suspended_count);
  return Number.isFinite(n) && n > 0 ? (" · " + n + " frozen") : "";
}


function renderHomeFleet(data) {
  const wrap = document.getElementById("home-fleet");
  const chips = document.getElementById("home-fleet-chips");
  if (!wrap || !chips) return;
  const items = (data && data.desktops) || [];
  const awake = items.filter((d) => d.live && !d.suspended);
  const frozen = items.filter((d) => d.suspended);
  if (!awake.length && !frozen.length) {
    wrap.hidden = true;
    chips.innerHTML = "";
    return;
  }
  wrap.hidden = false;
  const parts = [];
  awake.slice(0, 12).forEach((d) => {
    const n = Number(d && d.number);
    if (!Number.isFinite(n) || n < 0) return;
    const nInt = Math.trunc(n);
    const cur = d.current ? " current" : "";
    const label = d.current ? (":" + nInt + " · you") : (":" + nInt);
    parts.push('<a class="fleet-chip' + cur + '" href="/desktops?crew=' + nInt + '" title="Open crew :' + nInt + '">' + label + "</a>");
  });
  if (frozen.length) {
    parts.push('<a class="fleet-chip frozen" href="/desktops?filter=paused" title="Paused desks">' + frozen.length + " frozen</a>");
  }
  chips.innerHTML = parts.join("") || '<span class="fleet-empty">none awake</span>';
  const chatEl = document.getElementById("home-agent-chat");
  if (chatEl) {
    const cur = items.find((d) => d.current);
    const chats = (cur && Array.isArray(cur.chats)) ? cur.chats : [];
    if (chats.length) {
      const c0 = chats[0] || {};
      const site = c0.site || "chat";
      const title = c0.title || c0.url || "open";
      chatEl.hidden = false;
      chatEl.textContent = "You · :" + Math.trunc(Number(cur.number)) + " · " + site + " · " + title;
    } else {
      chatEl.hidden = true;
      chatEl.textContent = "";
    }
  }
}

function isEmptyStreamVal(text) {
  const t = String(text == null ? "" : text).trim();
  return !t || t === "—" || t === "--" || t === "…" || t === "...";
}

function setStream(id, text, href) {
  const el = document.getElementById(id);
  if (!el) return;
  const empty = isEmptyStreamVal(text);
  const display = empty ? "—" : text;
  el.classList.toggle("is-empty", empty);
  if (href && !empty) {
    el.textContent = "";
    const a = document.createElement("a");
    a.href = href;
    a.textContent = display;
    a.title = href;
    el.appendChild(a);
  } else {
    el.textContent = display;
  }
}


function renderHomeDemo(data, status) {
  const wrap = document.getElementById("home-demo-banner");
  const line = document.getElementById("home-demo-line");
  if (!wrap || !line) return;
  const sys = (data && data.system) || {};
  const st = (status && status.state) || sys.state || "—";
  const gostOn = !!(sys.gost_running || (status && status.gost && status.gost.running));
  const live = sys.live_count != null ? sys.live_count : "—";
  const frozen = Number(sys.suspended_count);
  const ram = Number(sys.ram_percent);
  const parts = [];
  parts.push('<span>' + String(st) + '</span>');
  parts.push('<span class="dim">·</span>');
  parts.push('<span>' + (gostOn ? "GOST on" : "GOST off") + '</span>');
  parts.push('<span class="dim">·</span>');
  parts.push('<span>' + live + ' live</span>');
  if (Number.isFinite(frozen) && frozen > 0) {
    parts.push('<span class="dim">·</span>');
    parts.push('<span class="warn">' + Math.trunc(frozen) + ' frozen</span>');
  }
  if (Number.isFinite(ram)) {
    parts.push('<span class="dim">·</span>');
    const cls = ram >= 85 ? 'warn' : (ram >= 65 ? 'elev' : '');
    const avail = Number(sys.ram_available_bytes);
    const freeBit = (ram >= 65 && Number.isFinite(avail)) ? (' · ' + (Math.round(avail / 1073741824 * 10) / 10) + ' free') : '';
    parts.push('<span class="' + cls + '">RAM ' + Math.round(ram) + '%' + freeBit + '</span>');
  }
  line.innerHTML = parts.join(" ");
  wrap.hidden = false;
}

function applyHomeStream(data) {
  const sys = (data && data.system) || {};
  const agentDisp = sys.agent_display || "—";
  const agentNum = Number(String(agentDisp).replace(/^:/, ""));
  setStream("hs-agent", agentDisp, Number.isFinite(agentNum) ? ("/desktops?crew=" + Math.trunc(agentNum)) : "/desktops");
  if (sys.live_count != null) {
    const ready = sys.viewer_ready != null ? sys.viewer_ready : null;
    const base = ready != null ? (sys.live_count + "·" + ready + " vnc") : String(sys.live_count);
    const fr = Number(sys.suspended_count);
    const frBit = (Number.isFinite(fr) && fr > 0) ? (" ·" + Math.trunc(fr) + " frz") : "";
    setStream("hs-live", base + frBit, "/desktops");
  } else {
    setStream("hs-live", "—", "/desktops");
  }
  const cpu = Number(sys.cpu_percent);
  setStream("hs-cpu", Number.isFinite(cpu) ? (Math.round(cpu * 10) / 10) + "%" : "—");

  const ramPct = Number(sys.ram_percent);
  const suspendedCount = Number(sys.suspended_count);
  const liveCount = Number(sys.live_count);
  const viewerReady = Number(sys.viewer_ready);
  // OOM bands: elevated (>=65) surfaces Report/Freeze; critical (>=85) unlocks Clear RAM.
  const elevRam = Number.isFinite(ramPct) && ramPct >= 65;
  const highRam = Number.isFinite(ramPct) && ramPct >= 85;
  const hasFrozen = Number.isFinite(suspendedCount) && suspendedCount > 0;
  const needsNovnc = Number.isFinite(liveCount) && Number.isFinite(viewerReady) && liveCount > viewerReady;
  const desks = (data && data.desktops) || [];
  // Match freezeQuietDesktops: skip current/busy/already-frozen; count quiet|idle|paused only.
  const quietCount = desks.filter((d) => {
    if (!d || !d.live || d.suspended || d.current) return false;
    const act = String(d.activity || "").toLowerCase();
    return act === "quiet" || act === "idle" || act === "paused";
  }).length;
  const hasQuiet = quietCount > 0;
  const ramCell = document.getElementById("hs-ram-cell");
  const cta = document.getElementById("hs-cta");
  const ctaClear = document.getElementById("hs-cta-clear");
  const ctaFreeze = document.getElementById("hs-cta-freeze");
  const ctaReport = document.getElementById("hs-cta-report");
  const ctaResume = document.getElementById("hs-cta-resume");
  const ctaNovnc = document.getElementById("hs-cta-novnc");
  if (Number.isFinite(ramPct)) {
    const used = fmtGiB(sys.ram_used_bytes);
    const total = fmtGiB(sys.ram_total_bytes);
    const avail = fmtGiB(sys.ram_available_bytes);
    const swapOn = !!sys.swap_enabled;
    const swapBit = swapOn ? " · swap on" : " · swap 0";
    // Dense STREAM: short visible value; full breakdown lives in title.
    setStream("hs-ram", Math.round(ramPct) + "% · " + avail + " free");
    if (ramCell) {
      ramCell.classList.toggle("elevated", elevRam && !highRam);
      ramCell.classList.toggle("pressure", highRam);
      ramCell.title = Math.round(ramPct) + "% · " + used + " used / " + total + " GiB · " + avail + " avail" + swapBit + " — " + (sys.swap_note || "prefer Actions for OOM relief");
    }
  } else {
    setStream("hs-ram", "—");
    if (ramCell) {
      ramCell.classList.remove("pressure");
      ramCell.classList.remove("elevated");
    }
  }
  // OOM story: never auto-fire. Mid-band Report/Freeze; Clear RAM only at critical.
  if (cta) cta.hidden = !(elevRam || highRam || hasFrozen || needsNovnc);
  if (ctaClear) ctaClear.hidden = !highRam;
  if (ctaFreeze) {
    ctaFreeze.hidden = !(elevRam && hasQuiet);
    if (!ctaFreeze.hidden) ctaFreeze.textContent = "Freeze " + quietCount + " quiet";
  }
  if (ctaReport) ctaReport.hidden = !elevRam;
  if (ctaResume) ctaResume.hidden = !hasFrozen;
  if (ctaNovnc) ctaNovnc.hidden = !needsNovnc;

  setStream("hs-gost", sys.gost_running ? "running" : "stopped", "/box");
  setStream("hs-state", sys.state || "—", "/box");
}

function clearHomeStream() {
  ["hs-agent", "hs-live", "hs-cpu", "hs-ram", "hs-gost", "hs-state"].forEach((id) => setStream(id, "—"));
  const ramCell = document.getElementById("hs-ram-cell");
  const cta = document.getElementById("hs-cta");
  const ctaClear = document.getElementById("hs-cta-clear");
  const ctaFreeze = document.getElementById("hs-cta-freeze");
  const ctaReport = document.getElementById("hs-cta-report");
  const ctaResume = document.getElementById("hs-cta-resume");
  const ctaNovnc = document.getElementById("hs-cta-novnc");
  const fleet = document.getElementById("home-fleet");
  const chips = document.getElementById("home-fleet-chips");
  if (ramCell) {
    ramCell.classList.remove("pressure");
    ramCell.classList.remove("elevated");
  }
  if (cta) cta.hidden = true;
  if (ctaClear) ctaClear.hidden = true;
  if (ctaFreeze) ctaFreeze.hidden = true;
  if (ctaReport) ctaReport.hidden = true;
  if (ctaResume) ctaResume.hidden = true;
  if (ctaNovnc) ctaNovnc.hidden = true;
  if (fleet) fleet.hidden = true;
  if (chips) chips.innerHTML = "";
}

async function fillHomeStream() {
  try {
    const data = await MaxQShell.getJSON("/desktops", "application/json");
    applyHomeStream(data);
    renderHomeFleet(data);
    return data;
  } catch (_) {
    clearHomeStream();
    return null;
  }
}

async function refreshHome() {
  const status = await MaxQShell.bootShell();
  lastHomeStatus = status;

  // STREAM strip + desktops tile — single /desktops fetch
  const desks = await fillHomeStream();
  if (desks) renderHomeDemo(desks, lastHomeStatus);
  if (desks) {
    const items = desks.desktops || [];
    const live = items.filter((d) => d.live).length;
    const ready = (desks.system && desks.system.viewer_ready != null)
      ? desks.system.viewer_ready
      : items.filter((d) => d.viewer_ok).length;
    const current = items.find((d) => d.current);
    const cur = current ? current.display : "—";
    setFoot("tile-desktops-foot", live + " live · " + ready + " vnc · current " + cur + frozenSeg(desks.system));
    setDesktopsTileLive(live);
  } else {
    setFoot("tile-desktops-foot", "unavailable");
    setDesktopsTileLive(0);
  }

  // Actions — catalog armed count
  fillTile("tile-actions-foot", "/actions", (data) => {
    const items = (data && data.actions) || [];
    const armed = items.filter((a) => a.armed).length;
    const unarmed = items.length - armed;
    const runs = ((data && data.runs) || []).length;
    let s = items.length + " actions · " + armed + " armed";
    if (unarmed > 0) s += " · " + unarmed + " unarmed";
    if (runs > 0) s += " · " + runs + " runs";
    return s;
  });

  // Processes — count from API
  fillTile("tile-processes-foot", "/api/processes", (data) => {
    const n = (data && data.count) != null ? data.count : ((data && data.processes) || []).length;
    const ram = Number(data && data.ram_percent);
    const avail = data && data.ram_available_bytes != null ? fmtGiB(data.ram_available_bytes) : null;
    let ramBit = "";
    if (Number.isFinite(ram)) {
      ramBit = " · RAM " + Math.round(ram) + "%";
      if (avail) ramBit += " · " + avail + " avail";
      if (data && data.swap_enabled === false) ramBit += " · swap 0";
    }
    return n + " processes" + ramBit;
  });

  // Files — HOME entry count
  fillTile("tile-files-foot", "/api/stubs/files", (data) => {
    const n = ((data && data.entries) || []).length;
    return "HOME · " + n + " entries";
  });

  // Sessions — profile count + signed-in
  fillTile("tile-sessions-foot", "/api/stubs/sessions", (data) => {
    const items = (data && data.sessions) || [];
    const signed = items.filter((s) => s.signed_in).length;
    const present = items.filter((s) => s.session_data_present).length;
    return items.length + " profiles · " + present + " with data" + (signed ? " · " + signed + " signed-in" : "");
  });

  // Handoff — live desktops + session evidence
  const handoffFrozen = frozenSeg(desks && desks.system);
  fillTile("tile-handoff-foot", "/api/stubs/handoff", (data) => {
    const d = (data && data.desktops) || {};
    const s = (data && data.sessions) || {};
    const live = d.live != null ? d.live : "—";
    const vnc = d.viewer_ready != null ? d.viewer_ready : "—";
    const evidence = s.session_data_present != null ? s.session_data_present : "—";
    return live + " live · " + vnc + " vnc · " + evidence + " session evidence" + handoffFrozen;
  });

  // Vault — slot count
  fillTile("tile-vault-foot", "/api/stubs/vault", (data) => {
    const count = data && data.count != null ? data.count : ((data && data.slots) || []).length;
    const present = data && data.present != null ? data.present : count;
    return present + "/" + count + " slots present";
  });

  // AI defaults — primary chat
  fillTile("tile-ai-foot", "/defaults", (data) => {
    const primary = (data && data.default_ai_chat) || "—";
    return "primary · " + primary;
  });

  // Skills — catalog count
  fillTile("tile-skills-foot", "/api/stubs/skills", (data) => {
    const n = data && data.count != null ? data.count : ((data && data.skills) || []).length;
    return n + " skill" + (n === 1 ? "" : "s");
  });

  // Box — applied state + listen (from boot status; no extra fetch)
  try {
    const state = status && status.state ? String(status.state) : "—";
    const listen = status && status.api && status.api.listen ? status.api.listen : "—";
    const pub =
      status && status.api && (status.api.api_public || status.api.ui_public)
        ? " · public"
        : "";
    setFoot("tile-box-foot", state + " · " + listen + pub);
  } catch (_) {
    setFoot("tile-box-foot", "machine controls");
  }

  return status;
}

async function pollHomeStream() {
  const desks = await fillHomeStream();
  if (desks) {
    renderHomeDemo(desks, lastHomeStatus);
    const items = desks.desktops || [];
    const live = items.filter((d) => d.live).length;
    const ready = (desks.system && desks.system.viewer_ready != null)
      ? desks.system.viewer_ready
      : items.filter((d) => d.viewer_ok).length;
    const current = items.find((d) => d.current);
    const cur = current ? current.display : "—";
    setFoot("tile-desktops-foot", live + " live · " + ready + " vnc · current " + cur + frozenSeg(desks.system));
    setDesktopsTileLive(live);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  refreshHome().catch(() => {});
  // Keep STREAM live for morning demo without refetching every tile (issue #8 follow-up).
  setInterval(() => {
    pollHomeStream().catch(() => {});
  }, 15000);
});
