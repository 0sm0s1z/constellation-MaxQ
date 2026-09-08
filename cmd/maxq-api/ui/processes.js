"use strict";

const MaxQProcesses = (() => {
  let rows = [];
  let timer = null;

  function $(id) { return document.getElementById(id); }

  function setMsg(text, isErr) {
    const el = $("proc-msg");
    if (!el) return;
    if (!text) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = text;
    el.style.color = isErr ? "var(--red)" : "var(--green)";
  }

  function flags(p) {
    const parts = [];
    if (p.maxq_owned) parts.push('<span class="badge maxq">maxq</span>');
    if (p.protected) parts.push('<span class="badge prot">protected</span>');
    return parts.length ? `<span class="proc-flags">${parts.join("")}</span>` : "—";
  }

  function filtered() {
    const q = (($("proc-filter") || {}).value || "").trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) => {
      const hay = [String(p.pid), p.user || "", p.command || ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  function render() {
    const body = $("proc-body");
    if (!body) return;
    const list = filtered();
    $("proc-count").textContent = String(list.length) + " / " + String(rows.length);
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="7" class="proc-empty">no matching processes</td></tr>';
      return;
    }
    body.innerHTML = list.map((p) => {
      const stop = p.stoppable
        ? `<button type="button" class="proc-stop" data-pid="${p.pid}">Stop</button>`
        : "";
      return `<tr class="proc-row${p.protected ? " protected" : ""}">
        <td class="pid">${p.pid}</td>
        <td class="user">${escapeHtml(p.user || "")}</td>
        <td class="cpu">${fmt(p.cpu_pct)}</td>
        <td class="mem">${fmt(p.mem_pct)}</td>
        <td>${flags(p)}</td>
        <td class="cmd">${escapeHtml(p.command || "")}</td>
        <td>${stop}</td>
      </tr>`;
    }).join("");
    body.querySelectorAll(".proc-stop").forEach((btn) => {
      btn.addEventListener("click", () => stopPid(Number(btn.getAttribute("data-pid"))));
    });
  }

  function fmt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    return v.toFixed(1);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }


  function fmtGiB(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return "—";
    return (n / (1024 ** 3)).toFixed(1) + " GiB";
  }

  function applyOOM(data) {
    const avail = $("proc-ram-avail");
    const used = $("proc-ram-used");
    const pct = $("proc-ram-pct");
    const swap = $("proc-ram-swap");
    const note = $("proc-oom-note");
    const banner = $("proc-pressure");
    const text = $("proc-pressure-text");
    const ramPct = Number(data && data.ram_percent);
    if (avail) avail.textContent = fmtGiB(data && data.ram_available_bytes);
    if (used) used.textContent = fmtGiB(data && data.ram_used_bytes) + " / " + fmtGiB(data && data.ram_total_bytes);
    if (pct) pct.textContent = Number.isFinite(ramPct) ? (Math.round(ramPct) + "%") : "—";
    if (swap) {
      const on = !!(data && data.swap_enabled);
      swap.textContent = on ? (fmtGiB(data.swap_total_bytes) + " total") : "0 (disabled)";
    }
    if (note) {
      note.textContent = (data && data.swap_note) ||
        "Prefer Actions over killing live desks. Do not enable swap without Matthew.";
    }
    const high = Number.isFinite(ramPct) && ramPct >= 85;
    if (banner) {
      if (high) {
        const nn = Math.round(ramPct);
        if (text) {
          text.textContent = "RAM pressure " + nn + "% — prefer Actions → Report RAM / Clear RAM / Freeze quiet over killing live desks.";
        }
        banner.hidden = false;
      } else {
        banner.hidden = true;
      }
    }
    const card = $("proc-oom");
    if (card) card.classList.toggle("pressure", high);
  }

  async function updatePressure() {
    // OOM card is filled from /api/processes in refresh(); keep banner sync via desktops as fallback.
    try {
      const data = await MaxQShell.getJSON("/desktops", "application/json");
      const sys = (data && data.system) || {};
      applyOOM({
        ram_percent: sys.ram_percent,
        ram_used_bytes: sys.ram_used_bytes,
        ram_total_bytes: sys.ram_total_bytes,
        ram_available_bytes: sys.ram_available_bytes,
        swap_total_bytes: sys.swap_total_bytes,
        swap_free_bytes: sys.swap_free_bytes,
        swap_enabled: sys.swap_enabled,
        swap_note: sys.swap_note,
      });
    } catch (_) {
      /* refresh() may still populate from /api/processes */
    }
  }

  async function refresh() {
    const st = $("proc-status");
    if (st) st.textContent = "loading";
    try {
      const data = await MaxQShell.getJSON("/api/processes");
      rows = Array.isArray(data.processes) ? data.processes : [];
      if ($("proc-self")) $("proc-self").textContent = String(data.self_pid || "—");
      if ($("proc-updated")) $("proc-updated").textContent = new Date().toLocaleTimeString();
      if (st) st.textContent = data.ok ? "ok" : "error";
      setMsg("");
      applyOOM(data);
      render();
      await updatePressure();
    } catch (e) {
      if (st) st.textContent = "error";
      setMsg(String(e && e.message ? e.message : e), true);
      const body = $("proc-body");
      if (body) body.innerHTML = '<tr><td colspan="7" class="proc-empty">failed to load /api/processes</td></tr>';
    }
  }

  async function stopPid(pid) {
    const row = rows.find((p) => p.pid === pid);
    if (!row || !row.stoppable) {
      setMsg("refusing stop: protected or unknown pid", true);
      return;
    }
    const ok = window.confirm("Send SIGTERM to pid " + pid + "?\n\n" + (row.command || ""));
    if (!ok) return;
    try {
      const r = await fetch("/api/processes/" + pid + "/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        setMsg((data && data.error) || ("stop failed " + r.status), true);
      } else {
        setMsg("sent " + (data.signal || "SIGTERM") + " to pid " + pid, false);
      }
      await refresh();
    } catch (e) {
      setMsg(String(e && e.message ? e.message : e), true);
    }
  }

  function syncAuto() {
    const on = !!( $("proc-auto") && $("proc-auto").checked );
    if (timer) { clearInterval(timer); timer = null; }
    if (on) timer = setInterval(refresh, 5000);
  }

  function boot() {
    $("proc-refresh") && $("proc-refresh").addEventListener("click", refresh);
    $("proc-filter") && $("proc-filter").addEventListener("input", render);
    $("proc-auto") && $("proc-auto").addEventListener("change", syncAuto);
    syncAuto();
    refresh();
  }

  return { boot, refresh };
})();

window.MaxQProcesses = MaxQProcesses;
