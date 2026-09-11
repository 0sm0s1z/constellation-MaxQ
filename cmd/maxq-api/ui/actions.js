"use strict";

const MaxQActions = (() => {
  function $(id) { return document.getElementById(id); }

  function setMsg(text, isErr) {
    const el = $("act-msg");
    if (!el) return;
    if (!text) { el.hidden = true; el.textContent = ""; return; }
    el.hidden = false;
    el.textContent = text;
    el.style.color = isErr ? "var(--red)" : "var(--green)";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // OOM bands match Home + Desktops STREAM: Clear RAM Run only at critical >=85%.
  const state = { ramPercent: NaN, elev: false, high: false };

  function oomRamBands(rp) {
    const n = Number(rp);
    return {
      rp: n,
      elev: Number.isFinite(n) && n >= 65,
      high: Number.isFinite(n) && n >= 85,
    };
  }

  function updateOomStrip(sys) {
    const bands = oomRamBands(sys && sys.ram_percent);
    state.ramPercent = bands.rp;
    state.elev = bands.elev;
    state.high = bands.high;
    const ramEl = $("act-ram");
    const oomEl = $("act-oom");
    const tile = $("act-ram-tile");
    const hint = $("act-oom-hint");
    if (ramEl) {
      ramEl.textContent = Number.isFinite(bands.rp) ? (Math.round(bands.rp) + "%") : "—";
    }
    if (tile) {
      tile.classList.toggle("elevated", bands.elev && !bands.high);
      tile.classList.toggle("pressure", bands.high);
    }
    if (oomEl) {
      if (bands.high) oomEl.textContent = "critical";
      else if (bands.elev) oomEl.textContent = "elevated";
      else if (Number.isFinite(bands.rp)) oomEl.textContent = "ok";
      else oomEl.textContent = "—";
    }
    if (hint) {
      if (bands.high) {
        hint.hidden = false;
        hint.textContent = "RAM critical (≥85%). Clear RAM is unlocked on Actions + STREAM. Prefer Report RAM → Freeze quiet first. Never auto-fire.";
      } else if (bands.elev) {
        hint.hidden = false;
        hint.textContent = "RAM elevated (≥65%). Report RAM + Freeze quiet are preferred. Clear RAM stays locked until critical (≥85%), matching Home/Desktops.";
      } else if (Number.isFinite(bands.rp)) {
        hint.hidden = false;
        hint.textContent = "OOM bands: elevated ≥65% · critical ≥85% (Clear RAM). Catalog stays visible; Clear RAM Run follows the same gate as Home/Desktops STREAM.";
      } else {
        hint.hidden = true;
        hint.textContent = "";
      }
    }
  }

  function clearRamArmed() {
    return state.high;
  }

  function renderRuns(runs) {
    const body = $("act-body");
    const list = Array.isArray(runs) ? runs.slice().sort((a, b) => String(b.started_at || "").localeCompare(String(a.started_at || ""))) : [];
    $("act-runs").textContent = String(list.length);
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="4" class="p2-empty">No recent runs yet. Persistence lives at <code>$HOME/.config/maxq/action-runs.json</code> (last ~20).</td></tr>';
      return;
    }
    body.innerHTML = list.map((r) => {
      const st = escapeHtml(r.state || "—");
      const badge = r.state === "ok" ? "ok" : (r.state === "error" ? "warn" : "dim");
      return `<tr>
        <td>${escapeHtml(r.label || r.action_id || "")}</td>
        <td><span class="p2-badge ${badge}">${st}</span></td>
        <td class="mono">${escapeHtml(r.started_at || "—")}</td>
        <td>${escapeHtml(r.detail || "")}</td>
      </tr>`;
    }).join("");
  }

  function renderActions(actions) {
    const grid = $("act-grid");
    const list = actions || [];
    $("act-count").textContent = String(list.length);
    $("act-armed").textContent = String(list.filter((a) => a.armed).length);
    if (!list.length) {
      grid.innerHTML = '<article class="p2-card"><h3>No actions</h3><p>Catalog empty.</p></article>';
      return;
    }
    grid.innerHTML = list.map((a) => {
      const badges = [];
      badges.push(`<span class="p2-badge ${a.armed ? "ok" : "warn"}">${a.armed ? "armed" : "unarmed"}</span>`);
      badges.push(`<span class="p2-badge dim">${escapeHtml(a.kind || "")}</span>`);
      badges.push(`<span class="p2-badge dim">${escapeHtml(a.runner || "")}</span>`);
      badges.push(`<span class="p2-badge secret">${escapeHtml(a.scope || "")}</span>`);
      const binds = (a.binds || []).map((b) => `<span class="p2-badge bind" title="bind">${escapeHtml(b)}</span>`).join("");
      let disabled = a.armed ? "" : "disabled";
      let unarmedHint = "";
      if (!a.armed && a.id === "close-idle-tabs") {
        unarmedHint = '<p class="p2-hint">Unarmed: set <code>webhook_url</code> in <code>$HOME/.config/maxq/hooks.toml</code>.</p>';
      } else if (!a.armed) {
        unarmedHint = '<p class="p2-hint">Unarmed — configure before run.</p>';
      }
      if (a.id === "clear-ram" && a.armed && !clearRamArmed()) {
        disabled = "disabled";
        const pct = Number.isFinite(state.ramPercent) ? Math.round(state.ramPercent) + "%" : "unknown";
        unarmedHint = '<p class="p2-hint">Locked until OOM critical (≥85%). Now ' + escapeHtml(pct) + ' — matches Home/Desktops STREAM. Prefer Report RAM / Freeze quiet.</p>';
        badges.push('<span class="p2-badge warn">critical≥85%</span>');
      } else if (a.id === "clear-ram" && a.armed && clearRamArmed()) {
        badges.push('<span class="p2-badge warn">unlocked</span>');
      }
      return `<article class="p2-card" data-id="${escapeHtml(a.id)}">
        <h3>${escapeHtml(a.label || a.id)}</h3>
        <p>${escapeHtml(a.description || "")}</p>
        ${unarmedHint}
        <div class="row">${badges.join("")}</div>
        <div class="row">${binds}</div>
        <div class="path">${escapeHtml(a.id)}</div>
        <div class="p2-toolbar">
          <button type="button" class="primary act-run" data-id="${escapeHtml(a.id)}" ${disabled}>Run</button>
        </div>
      </article>`;
    }).join("");
    grid.querySelectorAll(".act-run").forEach((btn) => {
      btn.addEventListener("click", () => runAction(btn.getAttribute("data-id"), btn));
    });
    highlightHashTarget();
  }

  function highlightHashTarget() {
    const raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return;
    const id = decodeURIComponent(raw);
    const grid = $("act-grid");
    if (!grid) return;
    grid.querySelectorAll(".p2-card.is-target").forEach((el) => el.classList.remove("is-target"));
    const card = grid.querySelector('.p2-card[data-id="' + CSS.escape(id) + '"]');
    if (!card) return;
    card.classList.add("is-target");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function runAction(id, btn) {
    if (!id) return;
    let confirmMsg = "Run action «" + id + "»? This posts /actions/" + id + "/run.";
    if (id === "resume-paused") {
      let n = null;
      try {
        const desks = await MaxQShell.getJSON("/desktops", "application/json");
        const sc = desks && desks.system && Number(desks.system.suspended_count);
        if (Number.isFinite(sc) && sc > 0) n = Math.trunc(sc);
      } catch (_) { /* fall through */ }
      confirmMsg = n != null
        ? ("Confirm resume " + n + " frozen? SIGCONT paused live desks except the current agent display.")
        : "Confirm resume frozen desks? SIGCONT all paused live desks except the current agent display.";
    } else if (id === "clear-ram") {
      if (!clearRamArmed()) {
        setMsg("Clear RAM locked until RAM ≥85% (match Home/Desktops).", true);
        return;
      }
      const pct = Number.isFinite(state.ramPercent) ? Math.round(state.ramPercent) + "%" : "critical";
      confirmMsg = "Clear RAM via OpenCode at " + pct + "? Protects current agent desktop, maxq-api, and live/busy desks. Never auto-fire.";
    } else if (id === "ensure-novnc") {
      confirmMsg = "Ensure noVNC viewers for live desks that already have x11vnc? Starts websockify only — never kills Chrome, Xvfb, or x11vnc.";
    } else if (id === "report-ram") {
      confirmMsg = "Report RAM from /proc/meminfo? Read-only — no kills.";
    } else if (id === "freeze-quiet-desks") {
      let n = null;
      try {
        const desks = await MaxQShell.getJSON("/desktops", "application/json");
        const list = (desks && desks.desktops) || [];
        const quiet = list.filter((d) => {
          if (!d || !d.live || d.suspended || d.current) return false;
          const act = String(d.activity || "").toLowerCase();
          return act === "quiet" || act === "idle" || act === "paused";
        });
        n = quiet.length;
      } catch (_) { /* fall through */ }
      confirmMsg = n != null
        ? ("Confirm freeze " + n + " quiet? SIGSTOP non-current idle/quiet desks. Skips current agent, busy, already frozen. Never auto-fire.")
        : "Confirm freeze quiet desks? SIGSTOP non-current idle/quiet desks. Skips current agent, busy, already frozen. Never auto-fire.";
    }
    if (!window.confirm(confirmMsg)) return;
    if (btn) btn.disabled = true;
    $("act-status").textContent = "running";
    try {
      const r = await fetch("/actions/" + encodeURIComponent(id) + "/run", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data && data.error) || ("run " + r.status));
      setMsg("queued " + (data.run && data.run.id ? data.run.id : id));
      await refresh();
      if (data.run && data.run.id) pollRun(data.run.id);
    } catch (e) {
      $("act-status").textContent = "error";
      setMsg(e instanceof Error ? e.message : String(e), true);
    } finally {
      if (btn && btn.getAttribute("data-id")) {
        // re-enable only if still armed (refresh may rebuild DOM)
      }
    }
  }

  async function pollRun(runId) {
    for (let i = 0; i < 40; i++) {
      await new Promise((res) => setTimeout(res, 1500));
      try {
        const data = await MaxQShell.getJSON("/actions/runs/" + encodeURIComponent(runId), "application/json");
        const run = data.run || data;
        if (run && (run.state === "ok" || run.state === "error")) {
          await refresh();
          setMsg(run.state + ": " + (run.detail || runId), run.state === "error");
          return;
        }
      } catch (_) { /* keep polling */ }
    }
  }

  async function refresh() {
    $("act-status").textContent = "loading";
    $("act-refresh").disabled = true;
    try {
      try {
        const desks = await MaxQShell.getJSON("/desktops", "application/json");
        updateOomStrip((desks && desks.system) || {});
      } catch (_) {
        updateOomStrip({});
      }
      const data = await MaxQShell.getJSON("/actions", "application/json");
      renderActions(data.actions || []);
      renderRuns(data.runs || []);
      $("act-status").textContent = "live";
      setMsg("");
    } catch (e) {
      $("act-status").textContent = "error";
      setMsg(e instanceof Error ? e.message : String(e), true);
    } finally {
      $("act-refresh").disabled = false;
    }
  }

  function boot() {
    $("act-refresh").addEventListener("click", () => refresh());
    window.addEventListener("hashchange", () => highlightHashTarget());
    refresh();
  }

  return { boot, refresh };
})();
