"use strict";

const MaxQVault = (() => {
  function $(id) { return document.getElementById(id); }

  function setMsg(text, isErr) {
    const el = $("vault-msg");
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

  function fmtSize(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return "—";
    if (v < 1024) return v + " B";
    if (v < 1024 * 1024) return (v / 1024).toFixed(1) + " KB";
    return (v / (1024 * 1024)).toFixed(1) + " MB";
  }

  function render(data) {
    $("vault-count").textContent = String(data.count || 0);
    $("vault-present").textContent = String(data.present || 0);
    $("vault-root").textContent = data.root || "—";
    const body = $("vault-body");
    const slots = data.slots || [];
    if (!slots.length) {
      body.innerHTML = '<tr><td colspan="8" class="p2-empty">no vault slots documented</td></tr>';
      return;
    }
    body.innerHTML = slots.map((s) => {
      const present = s.present
        ? '<span class="p2-badge ok">present</span>'
        : '<span class="p2-badge dim">missing</span>';
      const kind = s.secret
        ? `<span class="p2-badge secret">${escapeHtml(s.kind || "secret")}</span>`
        : `<span class="p2-badge">${escapeHtml(s.kind || "slot")}</span>`;
      return `<tr title="${escapeHtml(s.note || "")}">
        <td>${escapeHtml(s.name || "")}</td>
        <td>${kind}</td>
        <td>${present}</td>
        <td class="mono">${escapeHtml(s.mode || "—")}</td>
        <td class="mono">${fmtSize(s.size)}</td>
        <td class="mono">${escapeHtml(s.age || "—")}</td>
        <td class="mono">${escapeHtml(s.path || "")}</td>
        <td><span class="masked">••••••••</span></td>
      </tr>`;
    }).join("");
  }

  async function refresh() {
    $("vault-status").textContent = "loading";
    $("vault-refresh").disabled = true;
    try {
      const data = await MaxQShell.getJSON("/api/stubs/vault");
      render(data);
      $("vault-status").textContent = "live";
      setMsg("");
    } catch (e) {
      $("vault-status").textContent = "error";
      setMsg(e instanceof Error ? e.message : String(e), true);
    } finally {
      $("vault-refresh").disabled = false;
    }
  }

  function boot() {
    $("vault-refresh").addEventListener("click", () => refresh());
    refresh();
  }

  return { boot, refresh };
})();
