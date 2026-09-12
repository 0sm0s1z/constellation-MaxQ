"use strict";

const MaxQHandoff = (() => {
  function $(id) { return document.getElementById(id); }

  function setMsg(text, isErr) {
    const el = $("ho-msg");
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

  function authBadge(state) {
    switch (state) {
      case "signed-in":
        return '<span class="p2-badge ok">signed-in</span>';
      case "session-data-present":
        return '<span class="p2-badge warn">session present</span>';
      default:
        return '<span class="p2-badge dim">no auth evidence</span>';
    }
  }

  function renderFlow(data, desksResp) {
    const flow = data.flow || [];
    $("ho-flow").innerHTML = flow.map((step) => `
      <div class="p2-step">
        <div class="n">${escapeHtml(String(step.n))}</div>
        <div>
          <h3>${escapeHtml(step.title || "")}</h3>
          <p>${escapeHtml(step.body || "")}</p>
        </div>
      </div>`).join("");

    const links = $("ho-links");
    links.innerHTML = "";
    const map = data.links || {};
    Object.keys(map).forEach((k) => {
      const a = document.createElement("a");
      a.href = map[k];
      a.textContent = k + " →";
      links.appendChild(a);
    });

    const d = data.desktops || {};
    const s = data.sessions || {};
    $("ho-desktops").textContent = (d.live != null ? d.live : "—") + " / " + (d.total != null ? d.total : "—");
    const hv = $("ho-viewers");
    if (hv) hv.textContent = d.viewer_ready != null ? String(d.viewer_ready) : "—";
    let frozen = d.suspended_count;
    if (frozen == null && desksResp && desksResp.system && desksResp.system.suspended_count != null) {
      frozen = desksResp.system.suspended_count;
    }
    const hf = $("ho-frozen");
    if (hf) {
      const label = frozen != null ? String(frozen) : "—";
      if (frozen != null && Number(frozen) > 0) {
        hf.textContent = "";
        const a = document.createElement("a");
        a.href = "/desktops?filter=paused";
        a.textContent = label;
        a.title = "View paused desks";
        a.style.color = "inherit";
        a.style.textDecoration = "underline dashed";
        hf.appendChild(a);
      } else {
        hf.textContent = label;
      }
    }
    $("ho-sessions").textContent = String(s.total != null ? s.total : "—");
    $("ho-signed").textContent = String(s.signed_in != null ? s.signed_in : "—");
  }


  function renderLiveDesks(desks) {
    const body = $("ho-desks");
    if (!body) return;
    const items = ((desks && desks.desktops) || []).filter((d) => d.live);
    if (!items.length) {
      body.innerHTML = '<tr><td colspan="4" class="p2-empty">no live desktops</td></tr>';
      return;
    }
    body.innerHTML = items.map((d) => {
      const status = d.suspended ? "frozen" : (d.current ? "current" : "live");
      const statusClass = d.suspended ? "ho-status frozen" : (d.current ? "ho-status current" : "ho-status live");
      const viewer = d.viewer_ok ? "noVNC ready" : "viewer off";
      const href = "/desktops?crew=" + encodeURIComponent(String(d.number));
      return `<tr>
      <td class="mono">:${escapeHtml(String(d.number))}</td>
      <td><span class="${statusClass}">${escapeHtml(status)}</span></td>
      <td>${escapeHtml(viewer)}</td>
      <td><a class="p2-cta" href="${href}">Open in Crew</a></td>
    </tr>`;
    }).join("");
  }

  function renderSessions(data) {
    const body = $("ho-body");
    const sessions = (data.sessions || []).slice(0, 8);
    if (!sessions.length) {
      body.innerHTML = '<tr><td colspan="4" class="p2-empty">no browser sessions discovered</td></tr>';
      return;
    }
    body.innerHTML = sessions.map((s) => `<tr>
      <td>${escapeHtml(s.browser || "")}</td>
      <td class="mono">${escapeHtml(s.profile || "")}</td>
      <td>${authBadge(s.auth_state)}</td>
      <td class="mono">${escapeHtml(s.last_active || "—")}</td>
    </tr>`).join("");
  }

  async function refresh() {
    $("ho-status").textContent = "loading";
    $("handoff-refresh").disabled = true;
    try {
      const [handoff, sessions, desks] = await Promise.all([
        MaxQShell.getJSON("/api/stubs/handoff"),
        MaxQShell.getJSON("/api/stubs/sessions"),
        MaxQShell.getJSON("/desktops", "application/json"),
      ]);
      renderFlow(handoff, desks);
      renderLiveDesks(desks);
      renderSessions(sessions);
      $("ho-status").textContent = "live";
      setMsg("");
    } catch (e) {
      $("ho-status").textContent = "error";
      setMsg(e instanceof Error ? e.message : String(e), true);
    } finally {
      $("handoff-refresh").disabled = false;
    }
  }

  function boot() {
    $("handoff-refresh").addEventListener("click", () => refresh());
    refresh();
  }

  return { boot, refresh };
})();
